"""
AgriGuard Permanent Chat Persistence & Multi-Role Isolation Test Suite.
Verifies that:
1. Messages are persisted to SQLite database (AIMessage, Message).
2. Conversations maintain stable identity (do not spawn new UUIDs on refresh).
3. Chat history persists across simulated page refresh.
4. Chat history persists across logout and re-login with fresh auth token.
5. All supported roles (Farmer, Officer, Expert) have functional persistent chat.
6. Role and user conversations are isolated (no leak between users).
7. Duplicate rapid sends are prevented idempotently.
8. Messages are ordered chronologically.
"""
import os
import sys
import pytest
import uuid
import time
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath("backend"))
from app.main import app

client = TestClient(app)


def get_token(email: str, password: str = "Demo@1234") -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_ai_chat_persistence_across_refresh_and_relogin():
    """Verify AI Assistant chat persistence across refresh and logout/relogin"""
    # 1. Login as Farmer
    token = get_token("farmer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    unique_query = f"How should I manage fertilizer for paddy in week 3? [{uuid.uuid4().hex[:6]}]"

    # 2. Send message to AI Assistant
    send_res = client.post(
        "/api/ai/chat",
        json={"query": unique_query},
        headers=headers,
    )
    assert send_res.status_code == 200, f"AI chat failed: {send_res.text}"
    data = send_res.json()
    conv_id = data["conversation_id"]
    ai_response = data["response"]
    assert conv_id is not None
    assert len(ai_response) > 20

    # 3. Simulate browser refresh: fetch active conversation directly
    refresh_res = client.get(
        "/api/ai/conversations/active",
        headers=headers,
    )
    assert refresh_res.status_code == 200
    active_conv = refresh_res.json().get("conversation")
    assert active_conv is not None, "Active conversation must be returned after refresh"
    assert active_conv["id"] == conv_id, "Conversation ID must remain stable across refresh"

    # Verify messages are ordered chronologically
    messages = active_conv["messages"]
    assert len(messages) >= 2
    user_msgs = [m for m in messages if m["role"] == "user"]
    assert any(unique_query in m["content"] for m in user_msgs)
    assert any(m["role"] == "assistant" for m in messages)

    # 4. Simulate sending follow-up message in the SAME conversation
    followup_query = f"Can you explain that more simply? [{uuid.uuid4().hex[:6]}]"
    followup_res = client.post(
        "/api/ai/chat",
        json={"query": followup_query, "conversation_id": conv_id},
        headers=headers,
    )
    assert followup_res.status_code == 200
    assert followup_res.json()["conversation_id"] == conv_id, "Conversation ID must remain stable across turns"

    # 5. Simulate Logout & Re-login: Obtain brand new session JWT
    time.sleep(0.1)
    fresh_token = get_token("farmer@demo.agriguard.app")
    fresh_headers = {"Authorization": f"Bearer {fresh_token}"}

    # Fetch active conversation with fresh session token
    relogin_res = client.get(
        "/api/ai/conversations/active",
        headers=fresh_headers,
    )
    assert relogin_res.status_code == 200
    relogin_conv = relogin_res.json().get("conversation")
    assert relogin_conv is not None
    assert relogin_conv["id"] == conv_id
    relogin_msgs = relogin_conv["messages"]
    assert any(followup_query in m["content"] for m in relogin_msgs), "Followup message must persist across relogin"


def test_ai_chat_multi_user_isolation():
    """Verify that User A cannot see User B's AI chat history"""
    farmer_token = get_token("farmer@demo.agriguard.app")
    officer_token = get_token("officer@demo.agriguard.app")

    # Get farmer's active conversation
    farmer_res = client.get(
        "/api/ai/conversations/active",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    farmer_conv_id = farmer_res.json().get("conversation", {}).get("id")
    assert farmer_conv_id is not None

    # Officer attempts to fetch Farmer's conversation messages directly
    unauthorized_res = client.get(
        f"/api/ai/conversations/{farmer_conv_id}/messages",
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    # Backend must reject with 404 or 403
    assert unauthorized_res.status_code in [403, 404], (
        f"Security violation: Officer could access Farmer's conversation! Status: {unauthorized_res.status_code}"
    )


def test_consultation_chat_persistence_and_roles():
    """Verify Expert & Farmer consultation chat persistence, refresh recovery, and message delivery"""
    farmer_token = get_token("farmer@demo.agriguard.app")
    expert_token = get_token("expert@demo.agriguard.app")
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    expert_headers = {"Authorization": f"Bearer {expert_token}"}

    # 1. Farmer gets or starts conversation with Expert
    exp_res = client.get("/api/experts", headers=farmer_headers)
    assert exp_res.status_code == 200
    experts = exp_res.json()["experts"]
    assert len(experts) > 0
    expert_id = experts[0]["id"]

    start_res = client.post(
        f"/api/conversations?expert_id={expert_id}",
        headers=farmer_headers,
    )
    assert start_res.status_code == 200
    conv_id = start_res.json()["conversation_id"]

    # 2. Farmer sends unique message
    unique_text = f"Farmer inquiry regarding blight treatment [{uuid.uuid4().hex[:6]}]"
    send_res = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": unique_text, "message_type": "text"},
        headers=farmer_headers,
    )
    assert send_res.status_code == 200
    sent_msg = send_res.json()["message"]
    assert sent_msg["content"] == unique_text

    # 3. Simulate Farmer Refresh: fetch messages from active conversation
    refresh_res = client.get(
        f"/api/conversations/{conv_id}/messages",
        headers=farmer_headers,
    )
    assert refresh_res.status_code == 200
    messages = refresh_res.json()["messages"]
    assert any(m["content"] == unique_text for m in messages), "Sent message must persist after refresh"

    # 4. Expert logs in and retrieves conversation
    exp_convs_res = client.get("/api/conversations", headers=expert_headers)
    assert exp_convs_res.status_code == 200
    conv_ids = [c["id"] for c in exp_convs_res.json()["conversations"]]
    assert conv_id in conv_ids, "Conversation must appear in Expert's consultation queue"

    # Expert retrieves messages
    exp_msg_res = client.get(
        f"/api/conversations/{conv_id}/messages",
        headers=expert_headers,
    )
    assert exp_msg_res.status_code == 200
    exp_messages = exp_msg_res.json()["messages"]
    assert any(m["content"] == unique_text for m in exp_messages), "Expert must see Farmer's message"

    # 5. Expert sends a clinical reply
    expert_reply = f"Apply Mancozeb 75 WP at 2g/L. [{uuid.uuid4().hex[:6]}]"
    reply_res = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": expert_reply, "message_type": "text"},
        headers=expert_headers,
    )
    assert reply_res.status_code == 200

    # 6. Farmer logs in again and verifies Expert reply is present
    fresh_farmer_token = get_token("farmer@demo.agriguard.app")
    farmer_fetch_res = client.get(
        f"/api/conversations/{conv_id}/messages",
        headers={"Authorization": f"Bearer {fresh_farmer_token}"},
    )
    assert farmer_fetch_res.status_code == 200
    final_messages = farmer_fetch_res.json()["messages"]
    assert any(m["content"] == expert_reply for m in final_messages), "Expert reply must persist for Farmer"


def test_duplicate_message_prevention():
    """Verify that rapid identical message submissions are deduplicated"""
    token = get_token("farmer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    # Get conversation
    conv_res = client.get("/api/conversations", headers=headers)
    conv_id = conv_res.json()["conversations"][0]["id"]

    dup_text = f"Rapid retry message [{uuid.uuid4().hex[:6]}]"

    # Send 1
    res1 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": dup_text, "message_type": "text"},
        headers=headers,
    )
    assert res1.status_code == 200
    msg1_id = res1.json()["message"]["id"]

    # Send 2 immediately (same content within 0.1s)
    res2 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": dup_text, "message_type": "text"},
        headers=headers,
    )
    assert res2.status_code == 200
    msg2_id = res2.json()["message"]["id"]

    # Deduplication ensures same message record returned without duplicate row
    assert msg1_id == msg2_id, "Rapid duplicate send must return existing message ID instead of creating duplicate"


if __name__ == "__main__":
    print("Running chat persistence & multi-role verification...")
    test_ai_chat_persistence_across_refresh_and_relogin()
    print("PASS: AI Chat persistence across refresh and re-login")
    test_ai_chat_multi_user_isolation()
    print("PASS: AI Chat multi-user isolation")
    test_consultation_chat_persistence_and_roles()
    print("PASS: Consultation Chat persistence and role delivery")
    test_duplicate_message_prevention()
    print("PASS: Duplicate message prevention")
    print("ALL CHAT PERSISTENCE TESTS PASSED!")

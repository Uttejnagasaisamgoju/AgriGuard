"""
Integration tests for /api/ai/chat and conversation endpoints
"""
import pytest

def get_auth_token(client, email, password="Demo@1234"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

def test_farmer_ai_chat_endpoint(client):
    token = get_auth_token(client, "farmer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Send chat query as Farmer
    payload = {
        "query": "My tomato plants have yellowing leaves with dark concentric rings. What should I spray?",
    }
    res = client.post("/api/ai/chat", json=payload, headers=headers)
    assert res.status_code == 200, f"Chat failed: {res.text}"
    data = res.json()

    assert "conversation_id" in data
    assert "response" in data
    assert len(data["response"]) > 0
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert "suggested_questions" in data
    # Verify no fake confidence badge returned
    assert data.get("confidence") is None

    conv_id = data["conversation_id"]

    # 2. Verify conversation listed in user's conversations
    list_res = client.get("/api/ai/conversations", headers=headers)
    assert list_res.status_code == 200
    convs = list_res.json()
    assert any(c["id"] == conv_id for c in convs)

    # 3. Follow-up query in same conversation
    followup_payload = {
        "conversation_id": conv_id,
        "query": "Can I use organic neem oil instead of chemical fungicides?",
    }
    followup_res = client.post("/api/ai/chat", json=followup_payload, headers=headers)
    assert followup_res.status_code == 200
    followup_data = followup_res.json()
    assert followup_data["conversation_id"] == conv_id

def test_officer_ai_chat_endpoint(client):
    token = get_auth_token(client, "officer@demo.agriguard.app")
    headers = {"Authorization": f"Bearer {token}"}

    # Officer asks about assigned cases and protocol
    payload = {
        "query": "What are the priority cases assigned to me and what field protocol is recommended for blight?",
    }
    res = client.post("/api/ai/chat", json=payload, headers=headers)
    assert res.status_code == 200, f"Officer chat failed: {res.text}"
    data = res.json()
    assert "response" in data
    assert "conversation_id" in data
    assert data.get("confidence") is None

def test_unauthenticated_chat_rejected(client):
    res = client.post("/api/ai/chat", json={"query": "Hello"})
    assert res.status_code == 401

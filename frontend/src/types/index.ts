export type UserRole = 'FARMER' | 'OFFICER' | 'EXPERT' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  profile_image?: string;
  language?: string;
  is_active?: boolean;
  is_verified?: boolean;
  must_change_password?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  boundary_geojson?: any;
  area_hectares?: number;
  crop_type?: string;
  crop_variety?: string;
  planting_date?: string;
  sowing_date?: string;
  sowingDate?: string;
  soil_type?: string;
  irrigation_type?: string;
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  country?: string;
  created_at?: string;
  updated_at?: string;
  owner_name?: string;
}

export interface FarmTreatment {
  id: string;
  farm_id: string;
  user_id?: string;
  action_type: string;
  date: string;
  date_display?: string;
  description: string;
  related_disease?: string;
  prediction_id?: string;
  notes?: string;
  recorded_by_name?: string;
  recorded_by_role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FarmReportHistoryItem {
  id: string;
  farm_id?: string;
  farm_name: string;
  report_type?: string;
  period?: string;
  file_name: string;
  generated_at: string;
  generated_at_iso?: string;
  status: string;
  download_url: string;
}

export interface FarmReportData {
  farm: {
    id: string;
    name: string;
    crop_type: string;
    crop_variety?: string;
    sowing_date: string;
    has_sowing_date: boolean;
    area_hectares?: number;
    soil_type?: string;
    irrigation_type?: string;
    village?: string;
    district?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    owner_name?: string;
  };
  status_summary: {
    health_status: string;
    health_color: string;
    description: string;
    ndvi: number;
    ndvi_status: string;
    soil_moisture_pct: number;
    moisture_label: string;
    surface_temp: number;
    total_detections: number;
    active_infections: number;
    treatments_count: number;
  };
  disease_history: Array<{
    id: string;
    disease: string;
    crop: string;
    date_detected: string;
    date_iso?: string;
    confidence: number | null;
    confidence_display: string;
    severity: string;
    status: string;
    officer_case_id?: string;
  }>;
  has_disease_records: boolean;
  treatment_history: FarmTreatment[];
  has_treatment_records: boolean;
  timeline: {
    available: boolean;
    sowing_date?: string;
    days_elapsed?: number;
    total_cycle_days?: number;
    progress_pct?: number;
    current_stage?: string;
    current_focus?: string;
    days_to_next_stage?: number;
    estimated_harvest_date?: string;
    stages?: Array<{
      name: string;
      start_day: number;
      end_day: number;
      focus: string;
    }>;
    disclaimer?: string;
    message?: string;
  };
  weather: {
    available: boolean;
    provider?: string;
    temperature?: number;
    humidity?: number;
    rain_probability?: number;
    description?: string;
    wind_speed?: number;
    recorded_at?: string;
    message?: string;
    alerts: Array<{
      level: 'warning' | 'advisory' | 'info';
      title: string;
      description: string;
    }>;
  };
  report_history: FarmReportHistoryItem[];
  generated_at: string;
  generated_at_iso?: string;
}

export interface Disease {
  id: string;
  name: string;
  scientific_name?: string;
  crop_type: string;
  category: 'fungal' | 'bacterial' | 'viral' | 'pest' | 'nutritional' | 'environmental' | 'other';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  symptoms?: string;
  causes?: string;
  affected_parts?: string[];
  prevention?: string;
  management?: string;
  treatment?: string;
  favorable_conditions?: string;
  reference_images?: string[];
  ml_class_name?: string;
  created_at?: string;
}

export interface PredictionResult {
  prediction_id?: string;
  class_name?: string;
  disease: string;
  crop: string;
  confidence: number;
  category?: string;
  reference_image?: string | null;
  symptoms?: string;
  treatment?: string;
  prediction?: {
    disease: string;
    crop: string;
    confidence: number;
  };
  recommendations: string[];
  image_url?: string;
  image_filename?: string;
  top_predictions?: Array<{
    class_name: string;
    disease: string;
    crop: string;
    confidence: number;
    category: string;
  }>;
  severity?: string;
  model_version?: string;
  confidence_level?: string;
  disclaimer?: string;
  agricultural_analysis?: any;
  image_results?: any[];
}

export interface OfficerCase {
  id: string;
  farmer_id: string;
  farmer_name?: string;
  farm_id?: string;
  farm_name?: string;
  prediction_id?: string;
  status: 'NEW' | 'UNDER_REVIEW' | 'FIELD_VISIT_REQUIRED' | 'TREATMENT_RECOMMENDED' | 'RESOLVED';
  title: string;
  description?: string;
  officer_notes?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  time_ago?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  resolved_by_id?: string;
  resolved_by_name?: string;
  resolution_notes?: string;
}

export interface CaseHistoryTimelineEvent {
  id: string;
  timestamp: string;
  type: 'DETECTION' | 'AI_DIAGNOSIS' | 'FARMER_NOTE' | 'FIELD_VISIT' | 'FIELD_REPORT' | 'EXPERT_FEEDBACK' | 'RESOLUTION';
  title: string;
  description: string;
  author?: string;
  badge?: string;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  sender_id?: string;
  receiver_id?: string;
  sender_name?: string;
  message_type?: string;
  content: string;
  attachment_url?: string;
  metadata?: any;
  is_read?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  other_user?: {
    id: string;
    name: string;
    role: string;
    profile_image?: string;
  };
  last_message?: {
    content: string;
    created_at: string;
  };
  unread_count: number;
  last_message_at?: string;
}

export interface ExpertProfile {
  id: string;
  name: string;
  email: string;
  profile_image?: string;
  specialization?: string;
  qualifications?: string;
  years_experience?: string;
  crops_expertise?: string[];
  is_online: boolean;
  rating?: string;
  total_consultations?: string;
  bio?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  related_entity_id?: string;
  related_entity_type?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  disease_alerts: boolean;
  expert_messages: boolean;
  officer_updates: boolean;
  weather_alerts: boolean;
  system_updates: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  updated_at?: string;
}

export interface PushDeliveryLogItem {
  id: string;
  title: string;
  notification_type: string;
  status: 'delivered' | 'failed' | 'expired';
  status_code?: number;
  error_message?: string;
  created_at?: string;
}

export interface WeatherData {
  available: boolean;
  provider?: string;
  location?: string;
  temperature?: number;
  feels_like?: number;
  humidity?: number;
  wind_speed?: number;
  rain_probability?: number;
  description?: string;
  forecast?: any[];
  recorded_at?: string;
  error?: string;
  message?: string;
}

export interface DashboardData {
  user: { name: string; role: string };
  stats: {
    total_farms: number;
    diseases_detected: number;
    healthy_crops: number;
    active_officers: number;
  };
  recent_alerts: Array<{
    id: string;
    disease: string;
    crop: string;
    confidence: number;
    created_at: string;
  }>;
}

export interface OfficerDashboardData {
  stats: {
    farmers_monitored: number;
    total_cases: number;
    new_cases: number;
    resolved_today: number;
    pending_cases: number;
  };
  recent_cases: OfficerCase[];
}

export interface ReportData {
  period: string;
  /** ISO UTC timestamp for the start of the report period (authoritative from server) */
  period_start_utc?: string;
  /** ISO UTC timestamp for the exclusive end of the report period (authoritative from server) */
  period_end_utc?: string;
  summary: {
    total_farms: number;
    total_detections: number;
    disease_detections: number;
    healthy_detections: number;
    total_cases: number;
    resolved_cases: number;
    avg_confidence?: number;
  };
  disease_distribution: Array<{ disease: string; count: number }>;
  crop_distribution: Array<{ crop: string; count: number }>;
  disease_trend: Array<{ date: string; detections: number; healthy: number }>;
  has_data: boolean;
  message?: string;
}

export interface ExpertConsultationItem {
  id: string;
  farmer_id: string;
  farmer_name: string;
  crop: string;
  topic: string;
  priority: 'High' | 'Normal' | 'Medium' | 'Low';
  time: string;
  created_at?: string;
  unread?: boolean;
}

export interface ExpertDashboardData {
  expert: {
    name: string;
    email: string;
    specialization: string;
    is_online: boolean;
    is_verified: boolean;
    rating: string;
  };
  stats: {
    active_conversations: number;
    pending_questions: number;
    farmers_helped: number;
    avg_rating: string;
  };
  incoming_consultations: ExpertConsultationItem[];
}

export interface SatelliteData {
  farm_id: string;
  farm_name: string;
  crop_type?: string;
  area_hectares?: number;
  coordinates?: { latitude: number; longitude: number };
  satellite_provider?: string;
  acquisition_date?: string;
  ndvi_mean?: number;
  ndvi_min?: number;
  ndvi_max?: number;
  soil_moisture?: number | {
    percentage: number;
    status: string;
  };
  surface_temp?: number;
  cloud_cover_pct?: number;
  health_status?: 'Good' | 'Moderate' | 'Stressed' | 'Severe';
  captured_at?: string;
  imagery_source?: string;
  ndvi?: {
    value: number;
    status: string;
    health_category: string;
    color: string;
    min: number;
    max: number;
  };
  temperature?: {
    air_c: number;
    surface_c: number;
  };
  boundary_geojson?: any;
}


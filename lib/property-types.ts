export interface Violation {
  id: string;
  bbl: string;
  class: string;
  status: string | null;
  novdescription: string | null;
  inspectiondate: string | null;
  currentstatusdate: string | null;
}

export interface VacateOrder {
  id: string;
  bbl: string;
  vacate_type: string | null;
  reason: string | null;
  effective_date: string | null;
  units_vacated: string | null;
  rescind_date: string | null;
}

export interface Complaint {
  id: string;
  bbl: string;
  complaint_id: string | null;
  complaint_status: string | null;
  major_category: string | null;
  minor_category: string | null;
  type: string | null;
  received_date: string | null;
}

export interface Litigation {
  id: string;
  bbl: string;
  building_id: string | null;
  casetype: string | null;
  casestatus: string | null;
  caseopendate: string | null;
  respondent: string | null;
}

export interface BedbugReport {
  id: string;
  bbl: string;
  building_id: string | null;
  filing_date: string | null;
  infested_unit_count: number;
  eradicated_unit_count: number;
}

export interface BuildingDetails {
  building_id: string;
  bbl: string;
  legal_stories: number | null;
  legal_class_a: number | null;
  legal_class_b: number | null;
  dob_building_class: string | null;
  management_program: string | null;
  registration_id: string | null;
}

export interface RegistrationContact {
  id: string;
  registration_id: string;
  bbl: string;
  type: string;
  corporation_name: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_description: string | null;
  business_address: string | null;
}

export interface PropertyResponse {
  violations: Violation[];
  vacate_orders: VacateOrder[];
  complaints: Complaint[];
  complaint_count: number;
  litigations: Litigation[];
  bedbug_reports?: BedbugReport[];
  building_details?: BuildingDetails | null;
  registration_contacts?: RegistrationContact[];
  cached_at: string;
  aep_status?: AepEntry[];
  service_requests_311?: ServiceRequest311[];
  lead_violations?: LeadViolation[];
  work_orders?: WorkOrder[];
  from_cache: boolean;
  address_label?: string;
  nta?: string | null;
}

export interface LeadViolation {
  id: string;
  bbl: string;
  violation_id: string;
  class: string;
  status: string | null;
  novdescription: string | null;
  inspectiondate: string | null;
  currentstatusdate: string | null;
  apartment: string | null;
}

export interface WorkOrder {
  id: string;
  bbl: string;
  omo_id: string;
  omo_number: string | null;
  building_id: string | null;
  work_type: string | null;
  status_reason: string | null;
  award_amount: number | null;
  created_date: string | null;
  description: string | null;
}

export interface ServiceRequest311 {
  id: string;
  bbl: string;
  unique_key: string;
  agency: string | null;
  agency_name: string | null;
  complaint_type: string | null;
  descriptor: string | null;
  status: string | null;
  created_date: string | null;
  closed_date: string | null;
  resolution_description: string | null;
}

export interface AepEntry {
  id: string;
  bbl: string;
  building_id: string | null;
  aep_start_date: string | null;
  discharge_date: string | null;
  current_status: string | null;
  aep_round: string | null;
  violations_at_start: number | null;
}

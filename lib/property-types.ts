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
}

export interface Complaint {
  id: string;
  bbl: string;
  complaint_id: string | null;
  complaint_status: string | null;
  major_category: string | null;
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

export interface PropertyResponse {
  violations: Violation[];
  vacate_orders: VacateOrder[];
  complaints: Complaint[];
  complaint_count: number;
  litigations: Litigation[];
  bedbug_reports?: BedbugReport[];
  cached_at: string;
  from_cache: boolean;
  address_label?: string;
}

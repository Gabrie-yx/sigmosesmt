export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          base_risk_level: Database["public"]["Enums"]["risk_level"]
          created_at: string
          description: string | null
          geometry_polygon: Json | null
          id: string
          map_color: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_risk_level?: Database["public"]["Enums"]["risk_level"]
          created_at?: string
          description?: string | null
          geometry_polygon?: Json | null
          id?: string
          map_color?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_risk_level?: Database["public"]["Enums"]["risk_level"]
          created_at?: string
          description?: string | null
          geometry_polygon?: Json | null
          id?: string
          map_color?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string
          evidence_path: string | null
          id: string
          incident_id: string
          organization_id: string
          responsible_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date: string
          evidence_path?: string | null
          id?: string
          incident_id: string
          organization_id: string
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          evidence_path?: string | null
          id?: string
          incident_id?: string
          organization_id?: string
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_photos: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_timeline: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          incident_id: string
          message: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          incident_id: string
          message?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          incident_id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_timeline_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          area_id: string | null
          closed_at: string | null
          created_at: string
          description: string
          id: string
          immediate_actions: string | null
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at: string
          organization_id: string
          people_involved: string[] | null
          reported_by: string
          root_cause_data: Json | null
          root_cause_method: string | null
          root_cause_summary: string | null
          severity: Database["public"]["Enums"]["risk_level"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          closed_at?: string | null
          created_at?: string
          description: string
          id?: string
          immediate_actions?: string | null
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          organization_id: string
          people_involved?: string[] | null
          reported_by: string
          root_cause_data?: Json | null
          root_cause_method?: string | null
          root_cause_summary?: string | null
          severity: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          immediate_actions?: string | null
          incident_type?: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          organization_id?: string
          people_involved?: string[] | null
          reported_by?: string
          root_cause_data?: Json | null
          root_cause_method?: string | null
          root_cause_summary?: string | null
          severity?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loto_records: {
        Row: {
          created_at: string
          energy_point: string
          energy_type: string
          id: string
          installed_at: string
          installed_by: string
          lock_number: string
          notes: string | null
          organization_id: string
          permit_id: string
          removed_at: string | null
          removed_by: string | null
          tag_number: string | null
        }
        Insert: {
          created_at?: string
          energy_point: string
          energy_type: string
          id?: string
          installed_at?: string
          installed_by: string
          lock_number: string
          notes?: string | null
          organization_id: string
          permit_id: string
          removed_at?: string | null
          removed_by?: string | null
          tag_number?: string | null
        }
        Update: {
          created_at?: string
          energy_point?: string
          energy_type?: string
          id?: string
          installed_at?: string
          installed_by?: string
          lock_number?: string
          notes?: string | null
          organization_id?: string
          permit_id?: string
          removed_at?: string | null
          removed_by?: string | null
          tag_number?: string | null
        }
        Relationships: []
      }
      map_backgrounds: {
        Row: {
          created_at: string
          created_by: string
          height: number
          id: string
          is_active: boolean
          name: string
          opacity: number
          organization_id: string
          storage_path: string
          updated_at: string
          width: number
        }
        Insert: {
          created_at?: string
          created_by: string
          height: number
          id?: string
          is_active?: boolean
          name: string
          opacity?: number
          organization_id: string
          storage_path: string
          updated_at?: string
          width: number
        }
        Update: {
          created_at?: string
          created_by?: string
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          opacity?: number
          organization_id?: string
          storage_path?: string
          updated_at?: string
          width?: number
        }
        Relationships: []
      }
      map_features: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          geometry: Json
          id: string
          kind: string
          name: string
          organization_id: string
          style: Json
          subtype: string
          updated_at: string
          z_index: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          geometry: Json
          id?: string
          kind: string
          name: string
          organization_id: string
          style?: Json
          subtype: string
          updated_at?: string
          z_index?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          geometry?: Json
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          style?: Json
          subtype?: string
          updated_at?: string
          z_index?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permit_approval_matrix: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          permit_type: Database["public"]["Enums"]["permit_type"]
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          permit_type: Database["public"]["Enums"]["permit_type"]
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          permit_type?: Database["public"]["Enums"]["permit_type"]
          required_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      permit_confined_space_details: {
        Row: {
          atmospheric_test_at: string | null
          atmospheric_test_by: string | null
          co_ppm: number | null
          communication_means: string | null
          created_at: string
          forced_ventilation: boolean
          h2s_ppm: number | null
          id: string
          lel_percent: number | null
          notes: string | null
          o2_percent: number | null
          organization_id: string
          permit_id: string
          rescue_plan: string | null
          updated_at: string
          watcher_name: string
        }
        Insert: {
          atmospheric_test_at?: string | null
          atmospheric_test_by?: string | null
          co_ppm?: number | null
          communication_means?: string | null
          created_at?: string
          forced_ventilation?: boolean
          h2s_ppm?: number | null
          id?: string
          lel_percent?: number | null
          notes?: string | null
          o2_percent?: number | null
          organization_id: string
          permit_id: string
          rescue_plan?: string | null
          updated_at?: string
          watcher_name?: string
        }
        Update: {
          atmospheric_test_at?: string | null
          atmospheric_test_by?: string | null
          co_ppm?: number | null
          communication_means?: string | null
          created_at?: string
          forced_ventilation?: boolean
          h2s_ppm?: number | null
          id?: string
          lel_percent?: number | null
          notes?: string | null
          o2_percent?: number | null
          organization_id?: string
          permit_id?: string
          rescue_plan?: string | null
          updated_at?: string
          watcher_name?: string
        }
        Relationships: []
      }
      permit_counters: {
        Row: {
          last_number: number
          organization_id: string
          year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          year?: number
        }
        Relationships: []
      }
      permit_height_details: {
        Row: {
          anchor_point_description: string | null
          created_at: string
          height_meters: number | null
          id: string
          notes: string | null
          nr35_training_expiry: string | null
          nr35_training_valid: boolean
          organization_id: string
          permit_id: string
          protection_type: string | null
          rescue_equipment_present: boolean
          updated_at: string
          weather_condition: string | null
        }
        Insert: {
          anchor_point_description?: string | null
          created_at?: string
          height_meters?: number | null
          id?: string
          notes?: string | null
          nr35_training_expiry?: string | null
          nr35_training_valid?: boolean
          organization_id: string
          permit_id: string
          protection_type?: string | null
          rescue_equipment_present?: boolean
          updated_at?: string
          weather_condition?: string | null
        }
        Update: {
          anchor_point_description?: string | null
          created_at?: string
          height_meters?: number | null
          id?: string
          notes?: string | null
          nr35_training_expiry?: string | null
          nr35_training_valid?: boolean
          organization_id?: string
          permit_id?: string
          protection_type?: string | null
          rescue_equipment_present?: boolean
          updated_at?: string
          weather_condition?: string | null
        }
        Relationships: []
      }
      permit_hot_work_details: {
        Row: {
          area_isolated: boolean
          created_at: string
          fire_extinguisher_present: boolean
          fire_watch_name: string | null
          fire_watch_required: boolean
          flammable_materials_removed: boolean
          id: string
          notes: string | null
          organization_id: string
          permit_id: string
          updated_at: string
        }
        Insert: {
          area_isolated?: boolean
          created_at?: string
          fire_extinguisher_present?: boolean
          fire_watch_name?: string | null
          fire_watch_required?: boolean
          flammable_materials_removed?: boolean
          id?: string
          notes?: string | null
          organization_id: string
          permit_id: string
          updated_at?: string
        }
        Update: {
          area_isolated?: boolean
          created_at?: string
          fire_extinguisher_present?: boolean
          fire_watch_name?: string | null
          fire_watch_required?: boolean
          flammable_materials_removed?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          permit_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          current_organization_id: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessment_steps: {
        Row: {
          apr_id: string
          consequence: string | null
          controls: string | null
          created_at: string
          id: string
          residual_risk: Database["public"]["Enums"]["risk_level"]
          responsible: string | null
          risk: string
          severity: Database["public"]["Enums"]["risk_level"]
          step_description: string
          step_order: number
        }
        Insert: {
          apr_id: string
          consequence?: string | null
          controls?: string | null
          created_at?: string
          id?: string
          residual_risk?: Database["public"]["Enums"]["risk_level"]
          responsible?: string | null
          risk: string
          severity?: Database["public"]["Enums"]["risk_level"]
          step_description: string
          step_order?: number
        }
        Update: {
          apr_id?: string
          consequence?: string | null
          controls?: string | null
          created_at?: string
          id?: string
          residual_risk?: Database["public"]["Enums"]["risk_level"]
          responsible?: string | null
          risk?: string
          severity?: Database["public"]["Enums"]["risk_level"]
          step_description?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_steps_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          activity: string
          area_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          project_phase: string | null
          status: Database["public"]["Enums"]["apr_status"]
          title: string
          updated_at: string
          vessel: string | null
        }
        Insert: {
          activity: string
          area_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          project_phase?: string | null
          status?: Database["public"]["Enums"]["apr_status"]
          title: string
          updated_at?: string
          vessel?: string | null
        }
        Update: {
          activity?: string
          area_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          project_phase?: string | null
          status?: Database["public"]["Enums"]["apr_status"]
          title?: string
          updated_at?: string
          vessel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_library: {
        Row: {
          category: string
          created_at: string
          default_consequence: string | null
          default_controls: string | null
          default_severity: Database["public"]["Enums"]["risk_level"]
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          default_consequence?: string | null
          default_controls?: string | null
          default_severity?: Database["public"]["Enums"]["risk_level"]
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          default_consequence?: string | null
          default_controls?: string | null
          default_severity?: Database["public"]["Enums"]["risk_level"]
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trainings: {
        Row: {
          certificate_number: string | null
          created_at: string
          created_by: string
          expires_on: string
          id: string
          issued_on: string
          notes: string | null
          organization_id: string
          training_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          created_by: string
          expires_on: string
          id?: string
          issued_on: string
          notes?: string | null
          organization_id: string
          training_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          created_by?: string
          expires_on?: string
          id?: string
          issued_on?: string
          notes?: string | null
          organization_id?: string
          training_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_permit_approvals: {
        Row: {
          actor_id: string
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["permit_status"] | null
          id: string
          permit_id: string
          to_status: Database["public"]["Enums"]["permit_status"]
        }
        Insert: {
          actor_id: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["permit_status"] | null
          id?: string
          permit_id: string
          to_status: Database["public"]["Enums"]["permit_status"]
        }
        Update: {
          actor_id?: string
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["permit_status"] | null
          id?: string
          permit_id?: string
          to_status?: Database["public"]["Enums"]["permit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "work_permit_approvals_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "work_permits"
            referencedColumns: ["id"]
          },
        ]
      }
      work_permits: {
        Row: {
          additional_controls_justification: string | null
          apr_id: string | null
          area_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          identified_risks: string[] | null
          organization_id: string
          permit_number: string | null
          permit_type: Database["public"]["Enums"]["permit_type"]
          pre_execution_checklist: Json | null
          required_ppe: string[] | null
          responsible_name: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["permit_status"]
          team_members: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          additional_controls_justification?: string | null
          apr_id?: string | null
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          identified_risks?: string[] | null
          organization_id: string
          permit_number?: string | null
          permit_type: Database["public"]["Enums"]["permit_type"]
          pre_execution_checklist?: Json | null
          required_ppe?: string[] | null
          responsible_name?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          team_members?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          additional_controls_justification?: string | null
          apr_id?: string | null
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          identified_risks?: string[] | null
          organization_id?: string
          permit_number?: string | null
          permit_type?: Database["public"]["Enums"]["permit_type"]
          pre_execution_checklist?: Json | null
          required_ppe?: string[] | null
          responsible_name?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          team_members?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_permits_apr_id_fkey"
            columns: ["apr_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permits_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_permits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: string }
      area_risk_snapshot: {
        Args: { _org_id: string }
        Returns: {
          active_permits: number
          area_id: string
          confined_active: number
          height_active: number
          high_residual_aprs: number
          high_severity_incidents_30d: number
          hot_work_active: number
          open_incidents_30d: number
          upcoming_permits_24h: number
        }[]
      }
      bootstrap_organization: {
        Args: { _full_name?: string; _name: string; _slug: string }
        Returns: string
      }
      can_edit_permit_details: {
        Args: { _permit_id: string }
        Returns: boolean
      }
      get_invite_info: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      has_any_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      required_roles_for_permit: {
        Args: {
          _org_id: string
          _type: Database["public"]["Enums"]["permit_type"]
        }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      required_trainings_for_permit: {
        Args: { _type: Database["public"]["Enums"]["permit_type"] }
        Returns: string[]
      }
      resend_invite: { Args: { _invite_id: string }; Returns: undefined }
      revoke_invite: { Args: { _invite_id: string }; Returns: undefined }
      update_member_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "engineer" | "supervisor" | "technician"
      apr_status: "draft" | "active" | "archived"
      incident_status:
        | "open"
        | "investigating"
        | "corrective_actions"
        | "closed"
      incident_type: "accident" | "near_miss" | "deviation"
      permit_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "in_execution"
        | "completed"
        | "cancelled"
        | "blocked"
      permit_type:
        | "hot_work"
        | "confined_space"
        | "working_at_height"
        | "lifting"
        | "simops"
        | "other"
      risk_level: "low" | "medium" | "high" | "critical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "engineer", "supervisor", "technician"],
      apr_status: ["draft", "active", "archived"],
      incident_status: [
        "open",
        "investigating",
        "corrective_actions",
        "closed",
      ],
      incident_type: ["accident", "near_miss", "deviation"],
      permit_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "in_execution",
        "completed",
        "cancelled",
        "blocked",
      ],
      permit_type: [
        "hot_work",
        "confined_space",
        "working_at_height",
        "lifting",
        "simops",
        "other",
      ],
      risk_level: ["low", "medium", "high", "critical"],
    },
  },
} as const

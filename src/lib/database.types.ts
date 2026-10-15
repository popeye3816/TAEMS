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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contracts: {
        Row: {
          amount: number | null
          auto_renew: boolean
          billing_note: string | null
          contract_no: string | null
          contract_type: string | null
          contractor: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          end_user: string | null
          id: string
          note: string | null
          period_text: string | null
          products: string | null
          sales_rep_id: string | null
          sales_team: string | null
          source: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          auto_renew?: boolean
          billing_note?: string | null
          contract_no?: string | null
          contract_type?: string | null
          contractor?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          end_user?: string | null
          id?: string
          note?: string | null
          period_text?: string | null
          products?: string | null
          sales_rep_id?: string | null
          sales_team?: string | null
          source?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          auto_renew?: boolean
          billing_note?: string | null
          contract_no?: string | null
          contract_type?: string | null
          contractor?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          end_user?: string | null
          id?: string
          note?: string | null
          period_text?: string | null
          products?: string | null
          sales_rep_id?: string | null
          sales_team?: string | null
          source?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          note: string | null
          organization: string | null
          phone: string | null
          source: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          note?: string | null
          organization?: string | null
          phone?: string | null
          source?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          note?: string | null
          organization?: string | null
          phone?: string | null
          source?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          label: string
          note: string | null
          password_enc: string | null
          system_id: string | null
          updated_at: string
          username_enc: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          label: string
          note?: string | null
          password_enc?: string | null
          system_id?: string | null
          updated_at?: string
          username_enc?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          label?: string
          note?: string | null
          password_enc?: string | null
          system_id?: string | null
          updated_at?: string
          username_enc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credentials_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credentials_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "customer_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_systems: {
        Row: {
          business_name: string | null
          cpu: string | null
          created_at: string
          customer_id: string
          dump_path: string | null
          edition: string | null
          environment: string | null
          hostname: string | null
          id: string
          install_path: string | null
          ip_enc: string | null
          java_version: string | null
          license_count: number | null
          log_path: string | null
          memory: string | null
          note: string | null
          os: string | null
          product: string
          source: string
          updated_at: string
          version: string | null
        }
        Insert: {
          business_name?: string | null
          cpu?: string | null
          created_at?: string
          customer_id: string
          dump_path?: string | null
          edition?: string | null
          environment?: string | null
          hostname?: string | null
          id?: string
          install_path?: string | null
          ip_enc?: string | null
          java_version?: string | null
          license_count?: number | null
          log_path?: string | null
          memory?: string | null
          note?: string | null
          os?: string | null
          product: string
          source?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          business_name?: string | null
          cpu?: string | null
          created_at?: string
          customer_id?: string
          dump_path?: string | null
          edition?: string | null
          environment?: string | null
          hostname?: string | null
          id?: string
          install_path?: string | null
          ip_enc?: string | null
          java_version?: string | null
          license_count?: number | null
          log_path?: string | null
          memory?: string | null
          note?: string | null
          os?: string | null
          product?: string
          source?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_systems_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          annual_amount: number | null
          business_scope: string | null
          business_unit: string | null
          contact_temperament: string | null
          created_at: string
          extra_requirements: string | null
          group_name: string | null
          id: string
          importance: string | null
          incident_procedure: string | null
          inspection_cycle_note: string | null
          inspection_method: string | null
          name: string
          notes: string | null
          product_versions: string | null
          products: string[]
          remote_access: string | null
          sales_rep_id: string | null
          service_difficulty: string | null
          site_notes: string | null
          status: string
          support_count_note: string | null
          support_level: string | null
          support_method: string | null
          system_env_note: string | null
          updated_at: string
          updated_by: string | null
          visit_procedure: string | null
        }
        Insert: {
          address?: string | null
          annual_amount?: number | null
          business_scope?: string | null
          business_unit?: string | null
          contact_temperament?: string | null
          created_at?: string
          extra_requirements?: string | null
          group_name?: string | null
          id?: string
          importance?: string | null
          incident_procedure?: string | null
          inspection_cycle_note?: string | null
          inspection_method?: string | null
          name: string
          notes?: string | null
          product_versions?: string | null
          products?: string[]
          remote_access?: string | null
          sales_rep_id?: string | null
          service_difficulty?: string | null
          site_notes?: string | null
          status?: string
          support_count_note?: string | null
          support_level?: string | null
          support_method?: string | null
          system_env_note?: string | null
          updated_at?: string
          updated_by?: string | null
          visit_procedure?: string | null
        }
        Update: {
          address?: string | null
          annual_amount?: number | null
          business_scope?: string | null
          business_unit?: string | null
          contact_temperament?: string | null
          created_at?: string
          extra_requirements?: string | null
          group_name?: string | null
          id?: string
          importance?: string | null
          incident_procedure?: string | null
          inspection_cycle_note?: string | null
          inspection_method?: string | null
          name?: string
          notes?: string | null
          product_versions?: string | null
          products?: string[]
          remote_access?: string | null
          sales_rep_id?: string | null
          service_difficulty?: string | null
          site_notes?: string | null
          status?: string
          support_count_note?: string | null
          support_level?: string | null
          support_method?: string | null
          system_env_note?: string | null
          updated_at?: string
          updated_by?: string | null
          visit_procedure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_assignments: {
        Row: {
          created_at: string
          customer_id: string
          ended_on: string | null
          id: string
          note: string | null
          role: string
          staff_id: string
          started_on: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          ended_on?: string | null
          id?: string
          note?: string | null
          role: string
          staff_id: string
          started_on?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          ended_on?: string | null
          id?: string
          note?: string | null
          role?: string
          staff_id?: string
          started_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_plans: {
        Row: {
          created_at: string
          customer_id: string
          cycle: string
          id: string
          is_active: boolean
          method: string
          months: number[]
          needs_review: boolean
          preferred_timing: string | null
          products: string[]
          source_note: string | null
          updated_at: string
          visit_months: number[]
        }
        Insert: {
          created_at?: string
          customer_id: string
          cycle: string
          id?: string
          is_active?: boolean
          method?: string
          months?: number[]
          needs_review?: boolean
          preferred_timing?: string | null
          products?: string[]
          source_note?: string | null
          updated_at?: string
          visit_months?: number[]
        }
        Update: {
          created_at?: string
          customer_id?: string
          cycle?: string
          id?: string
          is_active?: boolean
          method?: string
          months?: number[]
          needs_review?: boolean
          preferred_timing?: string | null
          products?: string[]
          source_note?: string | null
          updated_at?: string
          visit_months?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "inspection_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          content_type: string | null
          created_at: string
          customer_id: string
          customer_signed: boolean
          file_name: string
          file_size: number | null
          id: string
          inspection_id: string
          product: string | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          customer_id: string
          customer_signed?: boolean
          file_name: string
          file_size?: number | null
          id?: string
          inspection_id: string
          product?: string | null
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          content_type?: string | null
          created_at?: string
          customer_id?: string
          customer_signed?: boolean
          file_name?: string
          file_size?: number | null
          id?: string
          inspection_id?: string
          product?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string
          engineer_id: string | null
          id: string
          method: string | null
          month: number
          plan_id: string | null
          products: string[]
          reported_at: string | null
          scheduled_date: string | null
          status: string
          summary: string | null
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id: string
          engineer_id?: string | null
          id?: string
          method?: string | null
          month: number
          plan_id?: string | null
          products?: string[]
          reported_at?: string | null
          scheduled_date?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          engineer_id?: string | null
          id?: string
          method?: string | null
          month?: number
          plan_id?: string | null
          products?: string[]
          reported_at?: string | null
          scheduled_date?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inspection_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          team: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          created_at: string
          customer_id: string | null
          file_name: string
          id: string
          is_active: boolean
          name: string
          product: string | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          file_name: string
          id?: string
          is_active?: boolean
          name: string
          product?: string | null
          storage_path: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          file_name?: string
          id?: string
          is_active?: boolean
          name?: string
          product?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_access_logs: {
        Row: {
          accessed_at: string
          customer_id: string
          id: number
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          accessed_at?: string
          customer_id: string
          id?: never
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          accessed_at?: string
          customer_id?: string
          id?: never
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secret_access_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["staff_kind"]
          name: string
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["staff_kind"]
          name: string
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["staff_kind"]
          name?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_engineer: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      is_my_sales_customer: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      is_staff_user: { Args: never; Returns: boolean }
    }
    Enums: {
      staff_kind: "engineer" | "sales"
      user_role: "admin" | "engineer" | "sales"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      staff_kind: ["engineer", "sales"],
      user_role: ["admin", "engineer", "sales"],
    },
  },
} as const

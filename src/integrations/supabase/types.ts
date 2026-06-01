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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          organization_id: string | null
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          preferences: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          preferences?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          preferences?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_items: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          end_time: string | null
          event_date: string | null
          guest_count: number | null
          id: string
          notes: string | null
          organization_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          total_amount: number
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_time?: string | null
          event_date?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          end_time?: string | null
          event_date?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          done: boolean
          due_date: string
          event_id: string | null
          id: string
          note: string | null
          organization_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          done?: boolean
          due_date: string
          event_id?: string | null
          id?: string
          note?: string | null
          organization_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          done?: boolean
          due_date?: string
          event_id?: string | null
          id?: string
          note?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string
          default_cost: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          reorder_level: number
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          reorder_level?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          reorder_level?: number
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          joined_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
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
          currency: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_id: string
          purchase_order_id: string
          quantity?: number
          received_quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_items_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_items_po_fk"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          expected_date: string | null
          id: string
          location_id: string | null
          notes: string | null
          order_number: string | null
          organization_id: string
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          supplier_id: string
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id: string
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          discount: number
          event_id: string
          id: string
          notes: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_rate: number
          total: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          discount?: number
          event_id: string
          id?: string
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          discount?: number
          event_id?: string
          id?: string
          notes?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          id: string
          item_id: string
          location_id: string
          organization_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          location_id: string
          organization_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          location_id?: string
          organization_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          item_id: string
          location_id: string
          organization_id: string
          purchase_order_id: string | null
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          item_id: string
          location_id: string
          organization_id: string
          purchase_order_id?: string | null
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          item_id?: string
          location_id?: string
          organization_id?: string
          purchase_order_id?: string | null
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_po_fk"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { _currency?: string; _name: string }
        Returns: string
      }
      event_org: { Args: { _event_id: string }; Returns: string }
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
      is_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      po_org: { Args: { _po_id: string }; Returns: string }
      receive_po_item: {
        Args: { _location_id: string; _po_item_id: string; _quantity: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "accountant" | "store_manager" | "staff"
      event_status:
        | "inquiry"
        | "quotation"
        | "confirmed"
        | "planning"
        | "execution"
        | "delivered"
        | "closed"
        | "cancelled"
      po_status:
        | "draft"
        | "ordered"
        | "partial"
        | "received"
        | "closed"
        | "cancelled"
      quotation_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      stock_movement_type: "in" | "out" | "adjust"
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
      app_role: ["admin", "manager", "accountant", "store_manager", "staff"],
      event_status: [
        "inquiry",
        "quotation",
        "confirmed",
        "planning",
        "execution",
        "delivered",
        "closed",
        "cancelled",
      ],
      po_status: [
        "draft",
        "ordered",
        "partial",
        "received",
        "closed",
        "cancelled",
      ],
      quotation_status: ["draft", "sent", "accepted", "rejected", "expired"],
      stock_movement_type: ["in", "out", "adjust"],
    },
  },
} as const

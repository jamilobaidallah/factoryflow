CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`sub_category` text DEFAULT '' NOT NULL,
	`associated_party` text DEFAULT '' NOT NULL,
	`owner_name` text,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`total_paid` real DEFAULT 0,
	`remaining_balance` real DEFAULT 0,
	`payment_status` text,
	`is_arap_entry` integer DEFAULT false,
	`total_discount` real DEFAULT 0,
	`writeoff_amount` real DEFAULT 0,
	`writeoff_reason` text,
	`writeoff_date` text,
	`writeoff_by` text,
	`immediate_settlement` integer DEFAULT false,
	`paid_from_advances` text,
	`total_paid_from_advances` real DEFAULT 0,
	`is_return_entry` integer DEFAULT false,
	`return_cost_amount` real DEFAULT 0,
	`return_inventory_sub_code` text,
	`is_cogs_reversal` integer DEFAULT false,
	`is_inventory_purchase` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_transaction_id_unique` ON `ledger` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`entry_number` text NOT NULL,
	`date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'posted' NOT NULL,
	`entry_status` text DEFAULT 'active' NOT NULL,
	`superseded_by` text,
	`source_type` text,
	`source_document_id` text,
	`source_transaction_id` text,
	`source_cheque_id` text,
	`is_reversal` integer DEFAULT false,
	`reverses_entry_id` text,
	`reversed_by_entry_id` text,
	`reversed_at` text,
	`reversal_reason` text,
	`reversal_type` text,
	`linked_transaction_id` text,
	`linked_payment_id` text,
	`linked_document_type` text,
	`created_at` text NOT NULL,
	`created_by` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `je_profile_idx` ON `journal_entries` (`profile_id`);--> statement-breakpoint
CREATE INDEX `je_date_idx` ON `journal_entries` (`date`);--> statement-breakpoint
CREATE INDEX `je_txn_idx` ON `journal_entries` (`linked_transaction_id`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`account_code` text NOT NULL,
	`account_name` text DEFAULT '' NOT NULL,
	`account_name_ar` text DEFAULT '' NOT NULL,
	`debit` real DEFAULT 0 NOT NULL,
	`credit` real DEFAULT 0 NOT NULL,
	`description` text,
	FOREIGN KEY (`journal_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jl_journal_idx` ON `journal_lines` (`journal_id`);--> statement-breakpoint
CREATE INDEX `jl_account_idx` ON `journal_lines` (`account_code`);--> statement-breakpoint
CREATE INDEX `jl_profile_idx` ON `journal_lines` (`profile_id`);--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`ledger_doc_id` text NOT NULL,
	`allocated_amount` real NOT NULL,
	`transaction_date` text,
	`description` text DEFAULT '',
	`created_at` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pa_payment_idx` ON `payment_allocations` (`payment_id`);--> statement-breakpoint
CREATE INDEX `pa_txn_idx` ON `payment_allocations` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`category` text,
	`sub_category` text,
	`is_multi_allocation` integer DEFAULT false,
	`total_allocated` real DEFAULT 0,
	`allocation_method` text,
	`allocation_count` integer DEFAULT 0,
	`linked_cheque_id` text,
	`is_endorsement` integer DEFAULT false,
	`no_cash_movement` integer DEFAULT false,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pay_profile_idx` ON `payments` (`profile_id`);--> statement-breakpoint
CREATE INDEX `pay_date_idx` ON `payments` (`date`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cli_profile_idx` ON `clients` (`profile_id`);--> statement-breakpoint
CREATE INDEX `cli_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`ownership_percentage` real DEFAULT 0 NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`initial_investment` real DEFAULT 0 NOT NULL,
	`join_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`capital_account_code` text,
	`drawings_account_code` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `par_profile_idx` ON `partners` (`profile_id`);--> statement-breakpoint
CREATE TABLE `cheques` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`cheque_number` text NOT NULL,
	`client_name` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`cheque_type` text,
	`status` text NOT NULL,
	`cheque_image_url` text,
	`endorsed_to` text,
	`endorsed_date` text,
	`endorsed_to_outgoing_id` text,
	`endorsed_supplier_transaction_id` text,
	`is_endorsed_cheque` integer DEFAULT false,
	`endorsed_from_id` text,
	`linked_transaction_id` text,
	`linked_payment_id` text,
	`paid_transaction_ids` text,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`cleared_date` text,
	`bounced_date` text,
	`bank_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`client_phone` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chq_profile_idx` ON `cheques` (`profile_id`);--> statement-breakpoint
CREATE INDEX `chq_due_date_idx` ON `cheques` (`due_date`);--> statement-breakpoint
CREATE INDEX `chq_status_idx` ON `cheques` (`status`);--> statement-breakpoint
CREATE TABLE `chart_of_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL,
	`type` text NOT NULL,
	`normal_balance` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_system_account` integer DEFAULT false,
	`is_contra_account` integer DEFAULT false,
	`parent_code` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `coa_profile_idx` ON `chart_of_accounts` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `coa_unique_code` ON `chart_of_accounts` (`profile_id`,`code`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`item_name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`sub_category` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`thickness` real,
	`width` real,
	`length` real,
	`last_purchase_price` real,
	`last_purchase_date` text,
	`last_purchase_amount` real,
	`inventory_account_code` text DEFAULT '1300',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_profile_idx` ON `inventory` (`profile_id`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`item_id` text NOT NULL,
	`item_name` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	`linked_transaction_id` text,
	`notes` text,
	`user_email` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `im_profile_idx` ON `inventory_movements` (`profile_id`);--> statement-breakpoint
CREATE INDEX `im_item_idx` ON `inventory_movements` (`item_id`);--> statement-breakpoint
CREATE TABLE `advances` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`remaining_amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`linked_transaction_id` text NOT NULL,
	`linked_payroll_month` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `adv_employee_idx` ON `advances` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`current_salary` real DEFAULT 0 NOT NULL,
	`overtime_eligible` integer DEFAULT true NOT NULL,
	`hire_date` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `emp_profile_idx` ON `employees` (`profile_id`);--> statement-breakpoint
CREATE TABLE `overtime_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`date` text NOT NULL,
	`hours` real NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`month` text NOT NULL,
	`linked_payroll_id` text,
	`created_at` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ot_employee_idx` ON `overtime_entries` (`employee_id`);--> statement-breakpoint
CREATE INDEX `ot_month_idx` ON `overtime_entries` (`month`);--> statement-breakpoint
CREATE TABLE `payroll` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`month` text NOT NULL,
	`base_salary` real NOT NULL,
	`full_monthly_salary` real,
	`days_worked` real,
	`days_in_month` integer,
	`is_prorated` integer DEFAULT false,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`overtime_pay` real DEFAULT 0 NOT NULL,
	`deductions` text,
	`bonuses` text,
	`advance_deduction` real DEFAULT 0,
	`advance_ids` text,
	`total_salary` real NOT NULL,
	`net_salary` real,
	`is_paid` integer DEFAULT false NOT NULL,
	`paid_date` text,
	`linked_transaction_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pay_employee_idx` ON `payroll` (`employee_id`);--> statement-breakpoint
CREATE INDEX `pay_month_idx` ON `payroll` (`month`);--> statement-breakpoint
CREATE TABLE `salary_history` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`old_salary` real NOT NULL,
	`new_salary` real NOT NULL,
	`increment_percentage` real DEFAULT 0 NOT NULL,
	`effective_date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sh_employee_idx` ON `salary_history` (`employee_id`);--> statement-breakpoint
CREATE TABLE `depreciation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_name` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`period` text NOT NULL,
	`period_label` text NOT NULL,
	`depreciation_amount` real NOT NULL,
	`accumulated_depreciation_before` real NOT NULL,
	`accumulated_depreciation_after` real NOT NULL,
	`book_value_before` real NOT NULL,
	`book_value_after` real NOT NULL,
	`ledger_entry_id` text,
	`recorded_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `fixed_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `dr_asset_idx` ON `depreciation_records` (`asset_id`);--> statement-breakpoint
CREATE INDEX `dr_profile_idx` ON `depreciation_records` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dr_unique_period` ON `depreciation_records` (`asset_id`,`period`);--> statement-breakpoint
CREATE TABLE `depreciation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`period` text NOT NULL,
	`run_date` text NOT NULL,
	`assets_count` integer DEFAULT 0 NOT NULL,
	`total_depreciation` real DEFAULT 0 NOT NULL,
	`ledger_entry_id` text NOT NULL,
	`run_type` text DEFAULT 'global',
	`asset_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drun_profile_idx` ON `depreciation_runs` (`profile_id`);--> statement-breakpoint
CREATE INDEX `drun_period_idx` ON `depreciation_runs` (`period`);--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`asset_number` text NOT NULL,
	`asset_name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`purchase_date` text NOT NULL,
	`purchase_cost` real NOT NULL,
	`salvage_value` real DEFAULT 0 NOT NULL,
	`useful_life_months` integer NOT NULL,
	`monthly_depreciation` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`accumulated_depreciation` real DEFAULT 0 NOT NULL,
	`book_value` real NOT NULL,
	`last_depreciation_date` text,
	`location` text,
	`serial_number` text,
	`supplier` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fa_profile_idx` ON `fixed_assets` (`profile_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`manual_invoice_number` text,
	`client_name` text NOT NULL,
	`client_address` text,
	`client_phone` text,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`items` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`invoice_image_url` text,
	`linked_transaction_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inv_invoice_profile_idx` ON `invoices` (`profile_id`);--> statement-breakpoint
CREATE INDEX `inv_invoice_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`order_number` text NOT NULL,
	`date` text NOT NULL,
	`input_item_id` text NOT NULL,
	`input_item_name` text NOT NULL,
	`input_quantity` real NOT NULL,
	`input_thickness` real,
	`input_width` real,
	`input_length` real,
	`output_item_name` text NOT NULL,
	`output_quantity` real NOT NULL,
	`output_thickness` real,
	`output_width` real,
	`output_length` real,
	`unit` text DEFAULT '' NOT NULL,
	`production_expenses` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'قيد التنفيذ' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `po_profile_idx` ON `production_orders` (`profile_id`);--> statement-breakpoint
CREATE INDEX `po_status_idx` ON `production_orders` (`status`);--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`user_email` text DEFAULT 'local' NOT NULL,
	`user_display_name` text,
	`action` text NOT NULL,
	`module` text NOT NULL,
	`target_id` text,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `al_profile_idx` ON `activity_logs` (`profile_id`);--> statement-breakpoint
CREATE INDEX `al_module_idx` ON `activity_logs` (`module`);--> statement-breakpoint
CREATE INDEX `al_date_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `ledger_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`sub_category` text DEFAULT '' NOT NULL,
	`associated_party` text DEFAULT '' NOT NULL,
	`owner_name` text,
	`description` text,
	`immediate_settlement` integer DEFAULT false,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fav_profile_idx` ON `ledger_favorites` (`profile_id`);
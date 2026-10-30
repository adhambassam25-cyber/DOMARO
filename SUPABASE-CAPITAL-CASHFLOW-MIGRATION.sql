-- DOMARO Capital & Cash Flow Tracker
create table if not exists public.accounting_capital_entries (
 id uuid primary key default gen_random_uuid(),
 entry_date date not null default (now() at time zone 'Africa/Cairo')::date,
 entry_type text not null check(entry_type in ('opening_balance','capital_contribution','owner_withdrawal','other_income','other_expense')),
 partner_name text, amount numeric(12,2) not null check(amount>0), payment_method text, reference text, notes text,
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists accounting_capital_entries_date_idx on public.accounting_capital_entries(entry_date desc,created_at desc);
alter table public.accounting_capital_entries enable row level security;
drop policy if exists "Accounting users can view capital entries" on public.accounting_capital_entries;
create policy "Accounting users can view capital entries" on public.accounting_capital_entries for select to authenticated using(public.has_admin_permission('accounting'));
drop policy if exists "Accounting users can add capital entries" on public.accounting_capital_entries;
create policy "Accounting users can add capital entries" on public.accounting_capital_entries for insert to authenticated with check(public.has_admin_permission('accounting') and created_by=auth.uid());
drop policy if exists "Accounting users can edit capital entries" on public.accounting_capital_entries;
create policy "Accounting users can edit capital entries" on public.accounting_capital_entries for update to authenticated using(public.has_admin_permission('accounting')) with check(public.has_admin_permission('accounting'));
drop policy if exists "Accounting users can delete capital entries" on public.accounting_capital_entries;
create policy "Accounting users can delete capital entries" on public.accounting_capital_entries for delete to authenticated using(public.has_admin_permission('accounting'));
grant select,insert,update,delete on public.accounting_capital_entries to authenticated;

create or replace function public.accounting_financial_overview()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb; v_profit jsonb;
begin
 if not public.has_admin_permission('accounting') then raise exception 'Not authorized to view accounting' using errcode='42501'; end if;
 v_profit:=public.accounting_summary(null::date,null::date);
 with manual_entries as (
  select coalesce(sum(amount) filter(where entry_type='opening_balance'),0)::numeric opening_cash,
   coalesce(sum(amount) filter(where entry_type='capital_contribution'),0)::numeric capital_contributions,
   coalesce(sum(amount) filter(where entry_type='owner_withdrawal'),0)::numeric owner_withdrawals,
   coalesce(sum(amount) filter(where entry_type='other_income'),0)::numeric other_income,
   coalesce(sum(amount) filter(where entry_type='other_expense'),0)::numeric other_expenses,
   count(*)::integer manual_entry_count from public.accounting_capital_entries
 ), supplier_cash as (select coalesce(sum(amount),0)::numeric supplier_payments from public.accounting_supplier_payments),
 operating_cash as (select coalesce(sum(amount),0)::numeric operating_expenses from public.accounting_expenses),
 order_cash as (select coalesce(sum(collected_amount),0)::numeric order_collections,coalesce(sum(actual_shipping_cost),0)::numeric actual_shipping_cost from public.accounting_order_finance),
 settlement_cash as (select coalesce(sum(fees),0)::numeric settlement_fees from public.accounting_settlements),
 stock as (select coalesce(sum(coalesce(stock_quantity,0)),0)::integer inventory_units,coalesce(sum(coalesce(stock_quantity,0)*coalesce(cost_price,0)),0)::numeric inventory_cost_value,count(*) filter(where coalesce(stock_quantity,0)>0 and coalesce(cost_price,0)<=0)::integer variants_missing_cost from public.product_variants where active=true)
 select jsonb_build_object(
  'opening_cash',m.opening_cash,'capital_contributions',m.capital_contributions,'owner_withdrawals',m.owner_withdrawals,
  'net_capital_retained',m.capital_contributions-m.owner_withdrawals,'other_income',m.other_income,'other_expenses',m.other_expenses,
  'order_collections',o.order_collections,'supplier_payments',s.supplier_payments,'operating_expenses',e.operating_expenses,
  'actual_shipping_cost',o.actual_shipping_cost,'settlement_fees',f.settlement_fees,
  'cash_in_total',m.opening_cash+m.capital_contributions+m.other_income+o.order_collections,
  'cash_out_total',m.owner_withdrawals+m.other_expenses+s.supplier_payments+e.operating_expenses+o.actual_shipping_cost+f.settlement_fees,
  'current_cash',m.opening_cash+m.capital_contributions+m.other_income+o.order_collections-m.owner_withdrawals-m.other_expenses-s.supplier_payments-e.operating_expenses-o.actual_shipping_cost-f.settlement_fees,
  'inventory_units',st.inventory_units,'inventory_cost_value',st.inventory_cost_value,'variants_missing_cost',st.variants_missing_cost,
  'manual_entry_count',m.manual_entry_count,'delivered_revenue',coalesce((v_profit->>'delivered_revenue')::numeric,0),
  'net_revenue',coalesce((v_profit->>'net_revenue')::numeric,0),'net_profit',coalesce((v_profit->>'net_profit')::numeric,0),
  'profit_cost_coverage_pct',coalesce((v_profit->>'cost_coverage_pct')::numeric,100)
 ) into v_result from manual_entries m cross join supplier_cash s cross join operating_cash e cross join order_cash o cross join settlement_cash f cross join stock st;
 return v_result;
end; $$;
grant execute on function public.accounting_financial_overview() to authenticated;
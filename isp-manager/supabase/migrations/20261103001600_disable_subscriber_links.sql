-- Phase 15: «رابط المشترك» cancelled. Every link stops working at once: nobody
-- (logged in or not) can call the link functions any more. No rows are deleted.

revoke all on function public.subscriber_public_view(text) from public, anon, authenticated;
revoke all on function public.subscriber_link(uuid) from public, anon, authenticated;
revoke all on function public.reset_subscriber_link(uuid) from public, anon, authenticated;
revoke all on function public.get_contact_phone() from public, anon, authenticated;
revoke all on function public.set_contact_phone(text) from public, anon, authenticated;

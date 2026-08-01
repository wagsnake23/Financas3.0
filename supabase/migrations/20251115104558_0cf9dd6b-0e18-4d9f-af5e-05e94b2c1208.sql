-- Add RLS policy to prevent users from granting themselves admin role
CREATE POLICY "Users cannot insert admin role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role != 'admin'::app_role OR 
  has_role(auth.uid(), 'admin'::app_role)
);
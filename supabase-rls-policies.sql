-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)
-- These policies allow authenticated users to manage their own availability slots

-- teacher_availability policies
CREATE POLICY "Users can read their own availability"
ON teacher_availability
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own availability"
ON teacher_availability
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability"
ON teacher_availability
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability"
ON teacher_availability
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- system_user policies (for staff updating their own isAvailable / reading own record)
CREATE POLICY "Users can read own system_user record"
ON system_user
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own system_user record"
ON system_user
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

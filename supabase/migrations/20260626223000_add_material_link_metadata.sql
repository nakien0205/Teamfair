-- Add description and preview image columns to materials table to support links
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS preview_img text;

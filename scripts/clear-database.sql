-- Limpa todos os dados do aplicativo (mantém schema e usuários de login)
TRUNCATE TABLE public.app_storage RESTART IDENTITY CASCADE;
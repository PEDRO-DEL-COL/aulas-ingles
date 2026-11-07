-- 05 - Novo valor do enum lesson_status. Fica SOZINHA nesta migration de proposito:
-- um valor de enum adicionado numa transacao so pode ser USADO depois do commit.
-- As migrations seguintes (e o trigger de cancelamento) ja podem usar 'cancelada_aluno'.
-- Idempotente (if not exists).

alter type public.lesson_status add value if not exists 'cancelada_aluno' after 'falta_aluno';

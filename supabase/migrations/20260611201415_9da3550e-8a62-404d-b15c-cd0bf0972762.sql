CREATE TABLE public.user_signatures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    signature_data TEXT NOT NULL, -- Base64 da imagem
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

-- Permite que usuários gerenciem suas próprias assinaturas
CREATE POLICY "Users can manage their own signatures" ON public.user_signatures
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Garante acesso aos papéis do sistema
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_signatures TO authenticated;
GRANT ALL ON public.user_signatures TO service_role;

-- Comentários
COMMENT ON TABLE public.user_signatures IS 'Galeria de assinaturas dos usuários';
COMMENT ON COLUMN public.user_signatures.signature_data IS 'Dados da imagem em formato Base64';
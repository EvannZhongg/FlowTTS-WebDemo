-- Keep cloned voice metadata aligned with the current FlowTTS model names.
-- Run this once in the Supabase SQL editor.

alter table public.cloned_voices
    drop constraint if exists cloned_voices_model_check;

alter table public.cloned_voices
    add constraint cloned_voices_model_check
    check (
        model is null
        or model in ('flow_01_turbo', 'flow_02_turbo', 'flow_01_ex')
    );

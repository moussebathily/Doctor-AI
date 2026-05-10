
CREATE TABLE public.pharmacy_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pharmacy_name TEXT NOT NULL,
  pharmacy_address TEXT,
  pharmacy_lat DOUBLE PRECISION,
  pharmacy_lng DOUBLE PRECISION,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INT NOT NULL DEFAULT 0,
  delivery_method TEXT NOT NULL DEFAULT 'pickup',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pharmacy orders all" ON public.pharmacy_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT,
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  common_doses TEXT[],
  interactions TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications readable by all" ON public.medications
  FOR SELECT USING (true);

CREATE INDEX idx_medications_name ON public.medications USING gin (to_tsvector('french', name || ' ' || coalesce(generic_name,'')));

INSERT INTO public.medications (name, generic_name, category, requires_prescription, common_doses, interactions, description) VALUES
('Doliprane 500mg', 'Paracétamol', 'Antalgique', false, ARRAY['1 cp x3/j','2 cp x3/j'], ARRAY['alcool','warfarine'], 'Antidouleur et antipyrétique courant.'),
('Doliprane 1000mg', 'Paracétamol', 'Antalgique', false, ARRAY['1 cp x3/j'], ARRAY['alcool','warfarine'], 'Forme dosée à 1g de paracétamol.'),
('Efferalgan 500mg', 'Paracétamol', 'Antalgique', false, ARRAY['1 cp x3/j'], ARRAY['alcool'], 'Paracétamol effervescent.'),
('Advil 200mg', 'Ibuprofène', 'AINS', false, ARRAY['1 cp x3/j'], ARRAY['aspirine','anticoagulants','IEC'], 'Anti-inflammatoire non stéroïdien.'),
('Nurofen 400mg', 'Ibuprofène', 'AINS', false, ARRAY['1 cp x3/j'], ARRAY['aspirine','anticoagulants'], 'Ibuprofène 400mg.'),
('Aspirine 500mg', 'Acide acétylsalicylique', 'AINS', false, ARRAY['1 cp x3/j'], ARRAY['ibuprofène','anticoagulants'], 'Antalgique et antiagrégant.'),
('Spasfon', 'Phloroglucinol', 'Antispasmodique', false, ARRAY['2 cp x3/j'], ARRAY[]::text[], 'Spasmes digestifs.'),
('Smecta', 'Diosmectite', 'Antidiarrhéique', false, ARRAY['1 sachet x3/j'], ARRAY[]::text[], 'Antidiarrhéique adsorbant.'),
('Imodium 2mg', 'Lopéramide', 'Antidiarrhéique', false, ARRAY['1 gel après chaque selle'], ARRAY[]::text[], 'Diarrhée aiguë.'),
('Maalox', 'Hydroxyde aluminium/magnésium', 'Antiacide', false, ARRAY['1 cp après repas'], ARRAY[]::text[], 'Brûlures d''estomac.'),
('Gaviscon', 'Alginate sodium', 'Antiacide', false, ARRAY['1 sachet après repas'], ARRAY[]::text[], 'Reflux gastro-œsophagien.'),
('Amoxicilline 500mg', 'Amoxicilline', 'Antibiotique', true, ARRAY['1 gel x3/j'], ARRAY['allopurinol','méthotrexate'], 'Antibiotique β-lactamine.'),
('Augmentin 1g', 'Amoxicilline + acide clavulanique', 'Antibiotique', true, ARRAY['1 cp x2/j'], ARRAY['warfarine'], 'Antibiotique large spectre.'),
('Azithromycine 250mg', 'Azithromycine', 'Antibiotique', true, ARRAY['2 cp J1 puis 1/j'], ARRAY['warfarine','digoxine'], 'Macrolide.'),
('Ventoline', 'Salbutamol', 'Bronchodilatateur', true, ARRAY['2 bouffées x4/j'], ARRAY['β-bloquants'], 'Crise d''asthme.'),
('Symbicort', 'Budésonide + formotérol', 'Corticoïde inhalé', true, ARRAY['2 inh matin et soir'], ARRAY[]::text[], 'Asthme persistant.'),
('Lévothyrox 50µg', 'Lévothyroxine', 'Hormone thyroïdienne', true, ARRAY['1 cp à jeun'], ARRAY['fer','calcium'], 'Hypothyroïdie.'),
('Metformine 500mg', 'Metformine', 'Antidiabétique', true, ARRAY['1 cp x2/j'], ARRAY['alcool','iode'], 'Diabète type 2.'),
('Glucophage 1000mg', 'Metformine', 'Antidiabétique', true, ARRAY['1 cp x2/j'], ARRAY['alcool'], 'Diabète type 2 dose forte.'),
('Coversyl 5mg', 'Périndopril', 'IEC', true, ARRAY['1 cp/j'], ARRAY['ibuprofène','potassium'], 'Hypertension.'),
('Amlor 5mg', 'Amlodipine', 'Inhibiteur calcique', true, ARRAY['1 cp/j'], ARRAY[]::text[], 'Hypertension.'),
('Kardegic 75mg', 'Acide acétylsalicylique', 'Antiagrégant', true, ARRAY['1 sachet/j'], ARRAY['anticoagulants'], 'Prévention cardiovasculaire.'),
('Préviscan 20mg', 'Fluindione', 'Anticoagulant', true, ARRAY['1 cp/j selon INR'], ARRAY['ibuprofène','aspirine','antibiotiques'], 'Anticoagulant oral.'),
('Lexomil', 'Bromazépam', 'Anxiolytique', true, ARRAY['1/4 cp x3/j'], ARRAY['alcool','opioïdes'], 'Anxiété.'),
('Stilnox 10mg', 'Zolpidem', 'Hypnotique', true, ARRAY['1 cp au coucher'], ARRAY['alcool'], 'Insomnie courte.'),
('Zoloft 50mg', 'Sertraline', 'Antidépresseur ISRS', true, ARRAY['1 cp/j'], ARRAY['IMAO','tramadol'], 'Dépression, anxiété.'),
('Vitamine D3 100000UI', 'Cholécalciférol', 'Vitamine', false, ARRAY['1 ampoule/3 mois'], ARRAY[]::text[], 'Carence en vitamine D.'),
('Tardyferon', 'Sulfate de fer', 'Fer', false, ARRAY['1 cp/j'], ARRAY['lévothyroxine','tétracyclines'], 'Anémie ferriprive.'),
('Magnésium B6', 'Magnésium', 'Minéral', false, ARRAY['2 cp x3/j'], ARRAY[]::text[], 'Fatigue, crampes.'),
('Humex rhume', 'Paracétamol + pseudoéphédrine', 'Rhume', false, ARRAY['1 cp x3/j'], ARRAY['IMAO','HTA'], 'Rhume avec congestion.');

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER pharmacy_orders_touch BEFORE UPDATE ON public.pharmacy_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

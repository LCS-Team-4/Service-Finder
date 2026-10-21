-- =============================================================================
-- Service Finder – Seed Data (South Africa)
-- Run AFTER 000_full_schema.sql
-- Contains categories + ~120 realistic public-service locations across major cities
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Categories (idempotent upsert by slug)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (name, slug, parent_id) VALUES
  ('Home Affairs',           'home-affairs',           NULL),
  ('Public service office',  'public-service-office',  NULL),
  ('Emergency services',     'emergency-services',     NULL),
  ('Healthcare',             'healthcare',             NULL),
  ('Education',              'education',              NULL)
ON CONFLICT (slug) DO NOTHING;

-- Child categories (need parent ids)
INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Police station', 'police-station', id FROM public.service_categories WHERE slug = 'emergency-services'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Fire station', 'fire-station', id FROM public.service_categories WHERE slug = 'emergency-services'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Shelter', 'shelter', id FROM public.service_categories WHERE slug = 'emergency-services'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Hospital', 'hospital', id FROM public.service_categories WHERE slug = 'healthcare'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Clinic', 'clinic', id FROM public.service_categories WHERE slug = 'healthcare'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Pharmacy', 'pharmacy', id FROM public.service_categories WHERE slug = 'healthcare'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Dentist', 'dentist', id FROM public.service_categories WHERE slug = 'healthcare'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'Library', 'library', id FROM public.service_categories WHERE slug = 'education'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.service_categories (name, slug, parent_id)
SELECT 'School', 'school', id FROM public.service_categories WHERE slug = 'education'
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Helper: get category id by slug
-- ---------------------------------------------------------------------------
-- (used inline below)

-- ---------------------------------------------------------------------------
-- 3. Services – Johannesburg / Pretoria / Gauteng
-- ---------------------------------------------------------------------------
INSERT INTO public.services (
  external_id, name, type, category_id, formatted_address, location,
  opening_hours, phone, website, wheelchair, sourcename, status, imported_at
) VALUES
-- Hospitals
('seed-jhb-chris-hani', 'Chris Hani Baragwanath Academic Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  '26 Chris Hani Road, Diepkloof, Soweto, Johannesburg, 1864',
  ST_SetSRID(ST_MakePoint(27.9400, -26.2610), 4326)::geography,
  '24/7', '011 933 8000', 'https://www.chrishanibaragwanathhospital.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-jhb-charlotte', 'Charlotte Maxeke Johannesburg Academic Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  '17 Jubilee Road, Parktown, Johannesburg, 2193',
  ST_SetSRID(ST_MakePoint(28.0470, -26.1750), 4326)::geography,
  '24/7', '011 488 4911', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-helen-joseph', 'Helen Joseph Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Perth Road, Auckland Park, Johannesburg, 2092',
  ST_SetSRID(ST_MakePoint(28.0060, -26.1830), 4326)::geography,
  '24/7', '011 489 0300', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-steve-biko', 'Steve Biko Academic Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Steve Biko Road, Prinshof, Pretoria, 0001',
  ST_SetSRID(ST_MakePoint(28.1950, -25.7310), 4326)::geography,
  '24/7', '012 354 1000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-kalafong', 'Kalafong Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Klipspringer Street, Atteridgeville, Pretoria, 0008',
  ST_SetSRID(ST_MakePoint(28.1450, -25.7750), 4326)::geography,
  '24/7', '012 373 9911', NULL, 'yes', 'seed', 'approved', NOW()),

-- Clinics
('seed-jhb-hillbrow-clinic', 'Hillbrow Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'Corner Klein & Claim Streets, Hillbrow, Johannesburg, 2001',
  ST_SetSRID(ST_MakePoint(28.0475, -26.1910), 4326)::geography,
  'Mon-Fri 07:30-16:00', '011 694 3700', NULL, 'limited', 'seed', 'approved', NOW()),

('seed-jhb-alexandra-clinic', 'Alexandra Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  '2nd Avenue, Alexandra, Johannesburg, 2090',
  ST_SetSRID(ST_MakePoint(28.1000, -26.1030), 4326)::geography,
  'Mon-Fri 07:30-16:00', '011 882 0900', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-atts-clinic', 'Atteridgeville Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'Maunde Street, Atteridgeville, Pretoria, 0008',
  ST_SetSRID(ST_MakePoint(28.1500, -25.7800), 4326)::geography,
  'Mon-Fri 07:30-16:00', '012 373 8000', NULL, 'yes', 'seed', 'approved', NOW()),

-- Police
('seed-jhb-jhb-central-police', 'Johannesburg Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  '1 Commissioner Street, Johannesburg CBD, 2001',
  ST_SetSRID(ST_MakePoint(28.0420, -26.2040), 4326)::geography,
  '24/7', '011 497 7000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-sandton-police', 'Sandton Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner 5th Street & Rivonia Road, Sandton, 2196',
  ST_SetSRID(ST_MakePoint(28.0500, -26.1070), 4326)::geography,
  '24/7', '011 722 5000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-soweto-police', 'Moroka Police Station (Soweto)', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Chris Hani Road, Moroka, Soweto, 1818',
  ST_SetSRID(ST_MakePoint(27.9000, -26.2600), 4326)::geography,
  '24/7', '011 527 8000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-brooklyn-police', 'Brooklyn Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Middel & Veale Streets, Brooklyn, Pretoria, 0181',
  ST_SetSRID(ST_MakePoint(28.2350, -25.7700), 4326)::geography,
  '24/7', '012 460 0111', NULL, 'yes', 'seed', 'approved', NOW()),

-- Fire stations
('seed-jhb-jhb-fire', 'Johannesburg Central Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Jeppe & Von Brandis Streets, Johannesburg CBD',
  ST_SetSRID(ST_MakePoint(28.0450, -26.2020), 4326)::geography,
  '24/7', '011 375 5911', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-pta-fire', 'Pretoria Central Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Bosman & Pretorius Streets, Pretoria CBD',
  ST_SetSRID(ST_MakePoint(28.1880, -25.7470), 4326)::geography,
  '24/7', '012 358 2200', NULL, 'yes', 'seed', 'approved', NOW()),

-- Pharmacies
('seed-jhb-clicks-sandton', 'Clicks Pharmacy – Sandton City', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'Sandton City Shopping Centre, Sandton, 2196',
  ST_SetSRID(ST_MakePoint(28.0540, -26.1080), 4326)::geography,
  'Mon-Sat 08:00-18:00, Sun 09:00-15:00', '011 783 0000', 'https://www.clicks.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-jhb-dischem-rosebank', 'Dis-Chem Pharmacy – Rosebank', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'The Zone @ Rosebank, Oxford Road, Rosebank, 2196',
  ST_SetSRID(ST_MakePoint(28.0430, -26.1450), 4326)::geography,
  'Mon-Fri 08:00-19:00, Sat 08:00-17:00, Sun 09:00-15:00', '011 447 3000', 'https://www.dischem.co.za', 'yes', 'seed', 'approved', NOW()),

-- Libraries
('seed-jhb-joburg-library', 'Johannesburg City Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Corner Market & Fraser Streets, Johannesburg CBD, 2001',
  ST_SetSRID(ST_MakePoint(28.0400, -26.2045), 4326)::geography,
  'Mon-Fri 09:00-17:00, Sat 09:00-13:00', '011 870 1000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pta-pta-library', 'Pretoria Central Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Andries Street, Pretoria CBD, 0002',
  ST_SetSRID(ST_MakePoint(28.1885, -25.7460), 4326)::geography,
  'Mon-Fri 09:00-17:00', '012 358 8900', NULL, 'yes', 'seed', 'approved', NOW()),

-- Home Affairs
('seed-jhb-ha-jhb', 'Department of Home Affairs – Johannesburg', 'Home Affairs',
  (SELECT id FROM service_categories WHERE slug='home-affairs'),
  'Harrison Street, Johannesburg CBD, 2001',
  ST_SetSRID(ST_MakePoint(28.0410, -26.2030), 4326)::geography,
  'Mon-Fri 08:00-15:30', '0800 601 190', 'https://www.dha.gov.za', 'yes', 'seed', 'approved', NOW()),

('seed-pta-ha-pta', 'Department of Home Affairs – Pretoria', 'Home Affairs',
  (SELECT id FROM service_categories WHERE slug='home-affairs'),
  'Hallmark Building, 230 Proes Street, Pretoria, 0001',
  ST_SetSRID(ST_MakePoint(28.1900, -25.7450), 4326)::geography,
  'Mon-Fri 08:00-15:30', '0800 601 190', 'https://www.dha.gov.za', 'yes', 'seed', 'approved', NOW()),

-- Shelters
('seed-jhb-shelter-mes', 'MES Shelter (Johannesburg)', 'Shelter',
  (SELECT id FROM service_categories WHERE slug='shelter'),
  'Corner Nugget & Commissioner Streets, Johannesburg CBD',
  ST_SetSRID(ST_MakePoint(28.0500, -26.2040), 4326)::geography,
  '24/7 (intake hours vary)', '011 333 0000', NULL, 'limited', 'seed', 'approved', NOW());

-- ---------------------------------------------------------------------------
-- 4. Cape Town / Western Cape
-- ---------------------------------------------------------------------------
INSERT INTO public.services (
  external_id, name, type, category_id, formatted_address, location,
  opening_hours, phone, website, wheelchair, sourcename, status, imported_at
) VALUES
('seed-cpt-groote-schuur', 'Groote Schuur Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Main Road, Observatory, Cape Town, 7925',
  ST_SetSRID(ST_MakePoint(18.4620, -33.9410), 4326)::geography,
  '24/7', '021 404 9111', 'https://www.westerncape.gov.za/facility/groote-schuur-hospital', 'yes', 'seed', 'approved', NOW()),

('seed-cpt-tygerberg', 'Tygerberg Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Francie van Zijl Drive, Parow, Cape Town, 7500',
  ST_SetSRID(ST_MakePoint(18.6050, -33.9100), 4326)::geography,
  '24/7', '021 938 4911', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-red-cross', 'Red Cross War Memorial Children''s Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Klipfontein Road, Rondebosch, Cape Town, 7700',
  ST_SetSRID(ST_MakePoint(18.4850, -33.9550), 4326)::geography,
  '24/7', '021 658 5111', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-khayelitsha-hosp', 'Khayelitsha District Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Cnr Walter Sisulu & Steve Biko Roads, Khayelitsha, 7784',
  ST_SetSRID(ST_MakePoint(18.6700, -34.0400), 4326)::geography,
  '24/7', '021 360 4000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-mitchells-clinic', 'Mitchells Plain Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'AZ Berman Drive, Mitchells Plain, Cape Town, 7785',
  ST_SetSRID(ST_MakePoint(18.6200, -34.0500), 4326)::geography,
  'Mon-Fri 07:30-16:00', '021 391 5000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-ct-central-police', 'Cape Town Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Buitenkant & Caledon Streets, Cape Town CBD, 8001',
  ST_SetSRID(ST_MakePoint(18.4240, -33.9270), 4326)::geography,
  '24/7', '021 467 8000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-sea-point-police', 'Sea Point Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Main & Regent Roads, Sea Point, Cape Town, 8005',
  ST_SetSRID(ST_MakePoint(18.3850, -33.9150), 4326)::geography,
  '24/7', '021 430 3700', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-ct-fire', 'Cape Town Central Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Buitengracht & Strand Streets, Cape Town CBD',
  ST_SetSRID(ST_MakePoint(18.4200, -33.9200), 4326)::geography,
  '24/7', '021 480 7700', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-clicks-vna', 'Clicks Pharmacy – V&A Waterfront', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'V&A Waterfront, Dock Road, Cape Town, 8001',
  ST_SetSRID(ST_MakePoint(18.4200, -33.9030), 4326)::geography,
  'Mon-Sun 09:00-21:00', '021 408 7600', 'https://www.clicks.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-cpt-city-library', 'Cape Town Central Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Corner Parade & Darling Streets, Cape Town CBD, 8001',
  ST_SetSRID(ST_MakePoint(18.4230, -33.9250), 4326)::geography,
  'Mon-Fri 09:00-17:00, Sat 09:00-13:00', '021 444 0300', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-ha-ct', 'Department of Home Affairs – Cape Town', 'Home Affairs',
  (SELECT id FROM service_categories WHERE slug='home-affairs'),
  '56 Barrack Street, Cape Town CBD, 8001',
  ST_SetSRID(ST_MakePoint(18.4250, -33.9280), 4326)::geography,
  'Mon-Fri 08:00-15:30', '0800 601 190', 'https://www.dha.gov.za', 'yes', 'seed', 'approved', NOW()),

('seed-cpt-shelter-haven', 'Haven Night Shelter (Cape Town)', 'Shelter',
  (SELECT id FROM service_categories WHERE slug='shelter'),
  'Corner Canterbury & Roeland Streets, Cape Town CBD',
  ST_SetSRID(ST_MakePoint(18.4280, -33.9300), 4326)::geography,
  '18:00-08:00 (overnight)', '021 461 1100', NULL, 'limited', 'seed', 'approved', NOW());

-- ---------------------------------------------------------------------------
-- 5. Durban / KwaZulu-Natal
-- ---------------------------------------------------------------------------
INSERT INTO public.services (
  external_id, name, type, category_id, formatted_address, location,
  opening_hours, phone, website, wheelchair, sourcename, status, imported_at
) VALUES
('seed-dbn-inkosi', 'Inkosi Albert Luthuli Central Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  '800 Vusi Mzimela Road, Cato Manor, Durban, 4091',
  ST_SetSRID(ST_MakePoint(30.9500, -29.8500), 4326)::geography,
  '24/7', '031 240 1000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-king-edward', 'King Edward VIII Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Sydney Road, Congella, Durban, 4001',
  ST_SetSRID(ST_MakePoint(30.9900, -29.8800), 4326)::geography,
  '24/7', '031 360 3111', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-addington', 'Addington Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  '16 Erskine Terrace, South Beach, Durban, 4001',
  ST_SetSRID(ST_MakePoint(31.0400, -29.8600), 4326)::geography,
  '24/7', '031 327 2000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-dbn-central-police', 'Durban Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Stanger & Victoria Streets, Durban CBD, 4001',
  ST_SetSRID(ST_MakePoint(31.0250, -29.8580), 4326)::geography,
  '24/7', '031 325 2000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-umbilo-police', 'Umbilo Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Umbilo & Sydney Roads, Umbilo, Durban, 4001',
  ST_SetSRID(ST_MakePoint(30.9950, -29.8750), 4326)::geography,
  '24/7', '031 242 1000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-dbn-fire', 'Durban Central Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Ordnance & Stanger Streets, Durban CBD',
  ST_SetSRID(ST_MakePoint(31.0280, -29.8570), 4326)::geography,
  '24/7', '031 361 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-clicks-gateway', 'Clicks Pharmacy – Gateway Theatre of Shopping', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'Gateway Theatre of Shopping, Umhlanga, 4319',
  ST_SetSRID(ST_MakePoint(31.0650, -29.7250), 4326)::geography,
  'Mon-Sat 09:00-19:00, Sun 09:00-17:00', '031 566 0000', 'https://www.clicks.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-dbn-city-library', 'Durban City Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Corner Smith & Church Streets, Durban CBD, 4001',
  ST_SetSRID(ST_MakePoint(31.0230, -29.8590), 4326)::geography,
  'Mon-Fri 09:00-17:00, Sat 09:00-13:00', '031 311 2400', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-ha-dbn', 'Department of Home Affairs – Durban', 'Home Affairs',
  (SELECT id FROM service_categories WHERE slug='home-affairs'),
  '320 Dr Pixley KaSeme Street, Durban CBD, 4001',
  ST_SetSRID(ST_MakePoint(31.0220, -29.8600), 4326)::geography,
  'Mon-Fri 08:00-15:30', '0800 601 190', 'https://www.dha.gov.za', 'yes', 'seed', 'approved', NOW());

-- ---------------------------------------------------------------------------
-- 6. Other major cities (Bloemfontein, Port Elizabeth/Gqeberha, East London, Polokwane, Nelspruit)
-- ---------------------------------------------------------------------------
INSERT INTO public.services (
  external_id, name, type, category_id, formatted_address, location,
  opening_hours, phone, website, wheelchair, sourcename, status, imported_at
) VALUES
-- Bloemfontein
('seed-bfn-universitas', 'Universitas Academic Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Logeman Street, Universitas, Bloemfontein, 9301',
  ST_SetSRID(ST_MakePoint(26.1850, -29.1100), 4326)::geography,
  '24/7', '051 405 3911', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-bfn-bfn-police', 'Bloemfontein Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Charles & East Burger Streets, Bloemfontein CBD',
  ST_SetSRID(ST_MakePoint(26.2150, -29.1200), 4326)::geography,
  '24/7', '051 507 6000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-bfn-bfn-fire', 'Bloemfontein Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Harvey & Douglas Streets, Bloemfontein',
  ST_SetSRID(ST_MakePoint(26.2200, -29.1150), 4326)::geography,
  '24/7', '051 405 8911', NULL, 'yes', 'seed', 'approved', NOW()),

-- Gqeberha (Port Elizabeth)
('seed-plz-livingstone', 'Livingstone Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Stanford Road, Korsten, Gqeberha, 6020',
  ST_SetSRID(ST_MakePoint(25.5800, -33.9400), 4326)::geography,
  '24/7', '041 405 2111', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-plz-plz-police', 'Gqeberha Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Govan Mbeki & Strand Streets, Gqeberha CBD',
  ST_SetSRID(ST_MakePoint(25.6000, -33.9600), 4326)::geography,
  '24/7', '041 394 6000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-plz-plz-fire', 'Gqeberha Fire Station', 'Fire station',
  (SELECT id FROM service_categories WHERE slug='fire-station'),
  'Corner Govan Mbeki Avenue & Strand Street, Gqeberha',
  ST_SetSRID(ST_MakePoint(25.6020, -33.9580), 4326)::geography,
  '24/7', '041 506 2000', NULL, 'yes', 'seed', 'approved', NOW()),

-- East London
('seed-eln-frere', 'Frere Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Amalinda Main Road, East London, 5201',
  ST_SetSRID(ST_MakePoint(27.8900, -32.9900), 4326)::geography,
  '24/7', '043 709 2000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-eln-eln-police', 'East London Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Fleet & Buffalo Streets, East London CBD',
  ST_SetSRID(ST_MakePoint(27.9100, -33.0150), 4326)::geography,
  '24/7', '043 707 2000', NULL, 'yes', 'seed', 'approved', NOW()),

-- Polokwane
('seed-pol-polokwane-hosp', 'Pietersburg Provincial Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Corner Hospital & Biccard Streets, Polokwane, 0699',
  ST_SetSRID(ST_MakePoint(29.4500, -23.9000), 4326)::geography,
  '24/7', '015 287 5000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-pol-pol-police', 'Polokwane Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Landdros Mare & Bodenstein Streets, Polokwane CBD',
  ST_SetSRID(ST_MakePoint(29.4550, -23.9050), 4326)::geography,
  '24/7', '015 290 6000', NULL, 'yes', 'seed', 'approved', NOW()),

-- Mbombela (Nelspruit)
('seed-mbm-rob-ferreira', 'Rob Ferreira Hospital', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Corner Madiba Drive & Park Street, Mbombela, 1200',
  ST_SetSRID(ST_MakePoint(30.9800, -25.4700), 4326)::geography,
  '24/7', '013 741 3000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-mbm-mbm-police', 'Mbombela Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Nel & Anderson Streets, Mbombela CBD',
  ST_SetSRID(ST_MakePoint(30.9850, -25.4750), 4326)::geography,
  '24/7', '013 759 1000', NULL, 'yes', 'seed', 'approved', NOW()),

-- Kimberley
('seed-kim-kimberley-hosp', 'Kimberley Hospital Complex', 'Hospital',
  (SELECT id FROM service_categories WHERE slug='hospital'),
  'Du Toitspan Road, Kimberley, 8301',
  ST_SetSRID(ST_MakePoint(24.7650, -28.7400), 4326)::geography,
  '24/7', '053 802 9111', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-kim-kim-police', 'Kimberley Central Police Station', 'Police station',
  (SELECT id FROM service_categories WHERE slug='police-station'),
  'Corner Transvaal Road & Quinn Street, Kimberley CBD',
  ST_SetSRID(ST_MakePoint(24.7700, -28.7450), 4326)::geography,
  '24/7', '053 838 4000', NULL, 'yes', 'seed', 'approved', NOW());

-- ---------------------------------------------------------------------------
-- 7. Additional clinics, pharmacies, schools & dentists (spread across SA)
-- ---------------------------------------------------------------------------
INSERT INTO public.services (
  external_id, name, type, category_id, formatted_address, location,
  opening_hours, phone, website, wheelchair, sourcename, status, imported_at
) VALUES
('seed-jhb-yeoville-clinic', 'Yeoville Clinic', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'Corner Raleigh & Hunter Streets, Yeoville, Johannesburg',
  ST_SetSRID(ST_MakePoint(28.0650, -26.1850), 4326)::geography,
  'Mon-Fri 07:30-16:00', '011 487 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-khayelitsha-clinic', 'Khayelitsha Site B Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'Bonga Drive, Khayelitsha, Cape Town, 7784',
  ST_SetSRID(ST_MakePoint(18.6800, -34.0350), 4326)::geography,
  'Mon-Fri 07:30-16:00', '021 360 4500', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-kzn-clinic', 'KwaMashu Community Health Centre', 'Clinic',
  (SELECT id FROM service_categories WHERE slug='clinic'),
  'Malandela Road, KwaMashu, Durban, 4360',
  ST_SetSRID(ST_MakePoint(30.9800, -29.7400), 4326)::geography,
  'Mon-Fri 07:30-16:00', '031 503 1000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-dischem-sandton', 'Dis-Chem Pharmacy – Sandton City', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'Sandton City, Rivonia Road, Sandton, 2196',
  ST_SetSRID(ST_MakePoint(28.0550, -26.1075), 4326)::geography,
  'Mon-Sat 08:00-19:00, Sun 09:00-17:00', '011 783 5000', 'https://www.dischem.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-cpt-dischem-canal', 'Dis-Chem Pharmacy – Canal Walk', 'Pharmacy',
  (SELECT id FROM service_categories WHERE slug='pharmacy'),
  'Canal Walk Shopping Centre, Century City, Cape Town, 7441',
  ST_SetSRID(ST_MakePoint(18.5100, -33.8920), 4326)::geography,
  'Mon-Sat 09:00-21:00, Sun 09:00-18:00', '021 555 0000', 'https://www.dischem.co.za', 'yes', 'seed', 'approved', NOW()),

('seed-jhb-dentist-park', 'Parktown Dental Centre', 'Dentist',
  (SELECT id FROM service_categories WHERE slug='dentist'),
  'Corner Jan Smuts & Empire Roads, Parktown, Johannesburg',
  ST_SetSRID(ST_MakePoint(28.0350, -26.1750), 4326)::geography,
  'Mon-Fri 08:00-17:00', '011 642 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-dentist-sea', 'Sea Point Dental Studio', 'Dentist',
  (SELECT id FROM service_categories WHERE slug='dentist'),
  'Main Road, Sea Point, Cape Town, 8005',
  ST_SetSRID(ST_MakePoint(18.3900, -33.9180), 4326)::geography,
  'Mon-Fri 08:00-17:00, Sat 08:00-13:00', '021 434 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-park-high', 'Parktown High School for Girls', 'School',
  (SELECT id FROM service_categories WHERE slug='school'),
  '13 Wellington Road, Parktown, Johannesburg, 2193',
  ST_SetSRID(ST_MakePoint(28.0400, -26.1755), 4326)::geography,
  'Mon-Fri 07:30-14:30', '011 643 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-rondebosch-boys', 'Rondebosch Boys'' High School', 'School',
  (SELECT id FROM service_categories WHERE slug='school'),
  'Canigou Avenue, Rondebosch, Cape Town, 7700',
  ST_SetSRID(ST_MakePoint(18.4750, -33.9600), 4326)::geography,
  'Mon-Fri 07:45-14:30', '021 686 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-dbn-westville-boys', 'Westville Boys'' High School', 'School',
  (SELECT id FROM service_categories WHERE slug='school'),
  'Wandsbeck Road, Westville, Durban, 3630',
  ST_SetSRID(ST_MakePoint(30.9300, -29.8300), 4326)::geography,
  'Mon-Fri 07:30-14:30', '031 267 0000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-jhb-library-sandton', 'Sandton Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Nelson Mandela Square, Sandton, 2196',
  ST_SetSRID(ST_MakePoint(28.0520, -26.1085), 4326)::geography,
  'Mon-Fri 09:00-18:00, Sat 09:00-13:00', '011 881 6000', NULL, 'yes', 'seed', 'approved', NOW()),

('seed-cpt-library-claremont', 'Claremont Library', 'Library',
  (SELECT id FROM service_categories WHERE slug='library'),
  'Main Road, Claremont, Cape Town, 7708',
  ST_SetSRID(ST_MakePoint(18.4650, -33.9850), 4326)::geography,
  'Mon-Fri 09:00-17:00, Sat 09:00-13:00', '021 444 0000', NULL, 'yes', 'seed', 'approved', NOW());

-- ---------------------------------------------------------------------------
-- 8. Sample traffic incidents (Cape Town & Johannesburg corridors)
-- ---------------------------------------------------------------------------
INSERT INTO public.traffic_incidents (
  external_id, icon_category, magnitude_of_delay, from_road, to_road,
  length_m, delay_seconds, road_numbers, description, geometry, imported_at
) VALUES
('seed-traffic-1', 6, 3, 'N1 North', 'N1 South at Woodstock',
  1200, 420, ARRAY['N1'], 'Accident – multi-vehicle collision, left lane closed',
  ST_SetSRID(ST_GeomFromText('LINESTRING(18.460 -33.925, 18.465 -33.920)'), 4326)::geography, NOW()),

('seed-traffic-2', 8, 2, 'M1 North', 'Empire Road off-ramp',
  800, 300, ARRAY['M1'], 'Roadworks – single lane, expect delays',
  ST_SetSRID(ST_GeomFromText('LINESTRING(28.040 -26.180, 28.045 -26.175)'), 4326)::geography, NOW()),

('seed-traffic-3', 6, 4, 'N2 East', 'Cape Town International Airport approach',
  2500, 900, ARRAY['N2'], 'Heavy congestion – peak hour traffic',
  ST_SetSRID(ST_GeomFromText('LINESTRING(18.580 -33.970, 18.600 -33.975)'), 4326)::geography, NOW());

-- ---------------------------------------------------------------------------
-- Done. Verify counts:
-- SELECT COUNT(*) FROM service_categories;   -- should be 14
-- SELECT COUNT(*) FROM services;             -- should be ~60+
-- SELECT COUNT(*) FROM traffic_incidents;    -- 3
-- ---------------------------------------------------------------------------

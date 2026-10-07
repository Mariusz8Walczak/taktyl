-- B-100..B-115 (TAKTYL-47, docs/16 par. 3.2): twarde usuniecie produktu lub wariantu bez zamowien musi usunac tez wiersze
-- price_history. Tabela zostaje tylko do dopisywania; jedyny wyjatek to DELETE w transakcji, ktora wlaczyla
-- `SET LOCAL taktyl.catalog_purge = 'on'` (tylko serwis katalogu, po sprawdzeniu braku zamowien).
CREATE OR REPLACE FUNCTION "taktyl_price_history_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('taktyl.catalog_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD."valid_to" IS NULL
     AND NEW."valid_to" IS NOT NULL
     AND NEW."id" = OLD."id"
     AND NEW."sku" = OLD."sku"
     AND NEW."price_gr" = OLD."price_gr"
     AND NEW."valid_from" = OLD."valid_from"
     AND NEW."valid_to" > OLD."valid_from" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'price_history jest tabela tylko do dopisywania (%)', TG_OP USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

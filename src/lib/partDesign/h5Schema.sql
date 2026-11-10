-- HSO Studio -> H5 content contract v1. MySQL 8.0.21+ / 8.4 recommended.
-- Select your H5 database before executing this entire setup script ONCE.
-- No legacy HSO tables are modified. No PNG bytes are stored here.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS h5_content_state (
  id TINYINT UNSIGNED PRIMARY KEY,
  schema_version INT UNSIGNED NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO h5_content_state(id,schema_version,revision)
SELECT 1,1,0 WHERE NOT EXISTS (SELECT 1 FROM h5_content_state WHERE id=1);

CREATE TABLE IF NOT EXISTS h5_rigs (
  rig_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  renderer_key VARCHAR(64) CHARACTER SET ascii NOT NULL,
  contract_version INT UNSIGNED NOT NULL
) ENGINE=InnoDB;
INSERT INTO h5_rigs(rig_id,renderer_key,contract_version)
SELECT r.rig_id,r.rig_id,1 FROM (
  SELECT 'humanoid-part-v1' rig_id UNION ALL SELECT 'weapon-wps-v1'
  UNION ALL SELECT 'mount-grid-v1' UNION ALL SELECT 'effect-mount-v1'
  UNION ALL SELECT 'pet-grid-v1' UNION ALL SELECT 'pet-tool-v1'
) r WHERE NOT EXISTS (SELECT 1 FROM h5_rigs e WHERE e.rig_id=r.rig_id);

CREATE TABLE IF NOT EXISTS h5_parts (
  part_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  slot ENUM('pants','shirt','weapon','mount','pet') NOT NULL,
  design_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  label VARCHAR(255) NOT NULL,
  rig_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  definition_json JSON NOT NULL,
  animation_json JSON NOT NULL,
  source_json JSON NOT NULL,
  content_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rig_id) REFERENCES h5_rigs(rig_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS h5_assets (
  asset_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  part_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role ENUM('sheet','splash') NOT NULL,
  path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,
  density TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY part_resource(part_key,role),
  UNIQUE KEY resource_path(path),
  FOREIGN KEY (part_key) REFERENCES h5_parts(part_key),
  CHECK (density BETWEEN 1 AND 4),
  CHECK (width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS h5_item_templates (
  item_id INT UNSIGNED PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  part_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requirements_json JSON NOT NULL,
  stats_json JSON NOT NULL,
  source_json JSON NOT NULL,
  FOREIGN KEY (part_key) REFERENCES h5_parts(part_key),
  CHECK (item_id BETWEEN 0 AND 2147483647)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Run this with a SQL client that supports DELIMITER (whole script mode).
-- The routine owns its transaction; call outside another transaction.
DELIMITER $$
CREATE PROCEDURE h5_register_part_v1(IN p_content JSON)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
  DECLARE v_key VARCHAR(96);
  DECLARE v_slot VARCHAR(16);
  DECLARE v_rig VARCHAR(64);
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_assets JSON;
  DECLARE v_asset JSON;
  DECLARE v_item JSON;
  DECLARE v_revision BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  IF COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.schema')),'') <> 'h5-part-content'
     OR COALESCE(JSON_EXTRACT(p_content,'$.version'),0) <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unsupported H5 content contract';
  END IF;
  SET v_key=JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.part.key'));
  SET v_slot=JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.part.slot'));
  SET v_rig=JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.part.rigId'));
  SET v_assets=JSON_EXTRACT(p_content,'$.assets');
  IF v_key IS NULL OR v_key NOT REGEXP '^[a-z0-9_-]+$'
     OR v_slot NOT IN ('pants','shirt','weapon','mount','pet')
     OR JSON_TYPE(v_assets) <> 'ARRAY' OR JSON_LENGTH(v_assets) NOT BETWEEN 1 AND 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid part identity or resources';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM h5_content_state WHERE id=1 AND schema_version=1)
     OR NOT EXISTS (SELECT 1 FROM h5_rigs WHERE rig_id=v_rig AND contract_version=1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Install matching H5 schema/renderer contract first';
  END IF;
  START TRANSACTION;
  -- Serializes content publication and revision changes.
  SELECT revision INTO v_revision FROM h5_content_state WHERE id=1 FOR UPDATE;
  INSERT INTO h5_parts(part_key,slot,design_id,label,rig_id,definition_json,animation_json,source_json,content_sha256)
  VALUES(v_key,v_slot,JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.part.designId')),
    JSON_UNQUOTE(JSON_EXTRACT(p_content,'$.part.label')),v_rig,
    JSON_EXTRACT(p_content,'$.part.definition'),JSON_EXTRACT(p_content,'$.part.animation'),
    JSON_EXTRACT(p_content,'$.part.source'),SHA2(CAST(p_content AS CHAR CHARACTER SET utf8mb4),256));
  WHILE v_i < JSON_LENGTH(v_assets) DO
    SET v_asset=JSON_EXTRACT(v_assets,CONCAT('$[',v_i,']'));
    IF COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.partKey')),'') <> v_key
       OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.sha256')),'') NOT REGEXP '^[a-f0-9]{64}$'
       OR JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.path')) NOT REGEXP '^parts/[a-z0-9_./-]+[.]png$'
       OR JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.path')) LIKE '%..%'
       OR JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.role')) NOT IN ('sheet','splash') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid PNG resource';
    END IF;
    INSERT INTO h5_assets(asset_key,part_key,role,path,sha256,width,height,density)
    VALUES(JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.key')),v_key,
      JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.role')),JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.path')),
      JSON_UNQUOTE(JSON_EXTRACT(v_asset,'$.sha256')),JSON_EXTRACT(v_asset,'$.width'),
      JSON_EXTRACT(v_asset,'$.height'),JSON_EXTRACT(v_asset,'$.density'));
    SET v_i=v_i+1;
  END WHILE;
  IF NOT EXISTS (SELECT 1 FROM h5_assets WHERE part_key=v_key AND role='sheet') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Primary sheet required';
  END IF;
  SET v_item=JSON_EXTRACT(p_content,'$.item');
  IF v_item IS NOT NULL AND JSON_TYPE(v_item) <> 'NULL' THEN
    IF COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_item,'$.partKey')),'') <> v_key THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Item must reference the registered part';
    END IF;
    INSERT INTO h5_item_templates(item_id,label,part_key,requirements_json,stats_json,source_json)
    VALUES(JSON_EXTRACT(v_item,'$.id'),JSON_UNQUOTE(JSON_EXTRACT(v_item,'$.label')),v_key,
      JSON_EXTRACT(v_item,'$.requirements'),JSON_EXTRACT(v_item,'$.stats'),JSON_EXTRACT(v_item,'$.source'));
  END IF;
  UPDATE h5_content_state SET revision=revision+1 WHERE id=1;
  COMMIT;
  SELECT v_key AS registered_part, revision AS content_revision FROM h5_content_state WHERE id=1;
END$$
DELIMITER ;

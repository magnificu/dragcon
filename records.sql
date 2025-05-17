BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "records" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"image_url"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
INSERT INTO "records" VALUES (1,'Lamp','/static/images/lightbulb.png');
INSERT INTO "records" VALUES (2,'Motor','/static/images/motor.png');
INSERT INTO "records" VALUES (3,'Pump','/static/images/pump.png');
INSERT INTO "records" VALUES (4,'Valve','/static/images/valve.png');
INSERT INTO "records" VALUES (5,'Elderberry','/static/images/question.png');
COMMIT;

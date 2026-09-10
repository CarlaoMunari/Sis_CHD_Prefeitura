-- SQL EXPORT - 49 TONERS
-- Sistema de Controle de Toners
-- Data: 2025-12-11

CREATE TABLE IF NOT EXISTS toners (
    id INT PRIMARY KEY,
    marca VARCHAR(100),
    modelo VARCHAR(200),
    toner VARCHAR(200),
    quantidade INT,
    realizar_pedido BOOLEAN,
    estoque_minimo INT
);

INSERT INTO toners VALUES
(1,'Brother','MFC-L8600CDW','TN-316 / TN-319',5,0,5),
(2,'Brother','HL-5370DW','TN-580 / TN-620 / TN-650',7,0,5),
(3,'Brother','DCP-8070D','TN-580 / TN-620 / TN-650',7,0,5),
(4,'Brother','DCP-8080DN','TN-580 / TN-620 / TN-650',7,0,5),
(5,'Brother','MFC-8480DN','TN-580 / TN-620 / TN-650',7,0,5),
(6,'Brother','MFC-8890DW','TN-580 / TN-620 / TN-650',7,0,5),
(7,'Brother','DCP-L2540DW','TN-660 / TN-2340 / TN-2370',6,0,5),
(8,'Brother','DCP-1617MW','TN-1060',14,0,5),
(9,'Brother','DCP-L2540DW','TN-2340 / TN-2370 / TN-3422 / TN-3442',7,0,5),
(10,'Brother','HL-B2080DW','TN-B021',7,0,5),
(11,'Brother','HL-L5202DW','TN-3422 / TN-3442 / TN-3472',26,0,5),
(12,'Brother','DCP-L5652DN','TN-3422 / TN-3442 / TN-3472',26,0,5),
(13,'Brother','DCP-8157DW','TN-3422 / TN-3442 / TN-3472',26,0,5),
(14,'Brother','MFC-8712DW','TN-3422 / TN-3442 / TN-3472',26,0,5),
(15,'Brother','MFC-J6510DW','LC75BK / LC75C / LC75Y / LC75M',16,0,5),
(16,'Brother','DCP-L5512DN','BQ-TN3612',2,1,5),
(17,'Brother','DCP-L3560CDW','TN219',0,1,5),
(18,'Canon','G3110','Tank',0,1,5),
(19,'Elgin','Pantum P2500W','PB-210 / PB-211',3,1,5),
(20,'Epson','L555','544 Tank',6,0,5),
(21,'Epson','L3110','544 Tank',6,0,5),
(22,'Epson','L3150','544 Tank',6,0,5),
(23,'Epson','L3210','544 Tank',6,0,5),
(24,'Epson','L3250','544 Tank',6,0,5),
(25,'Epson','L4260','544 Tank',6,0,5),
(26,'Epson','L6490','544 Tank',6,0,5),
(27,'HP','LaserJet 1020 / 3052','12A',17,0,5),
(28,'HP','LaserJet Pro M426 DW','CF226X / P-740-A',5,0,5),
(29,'HP','LaserJet P1005','35A',16,0,5),
(30,'HP','LaserJet M1120 MFP','36A',16,0,5),
(31,'HP','LaserJet Pro MFP-M428 FDW','58X',16,0,5),
(32,'HP','LaserJet Pro MFP-4103 FDW','W1030X',5,0,5),
(33,'HP','LaserJet Pro 400 M401 DN','80A / 80X / 500X / 505X',6,0,5),
(34,'HP','LaserJet Pro M125A MFP','83A',16,0,5),
(35,'HP','LaserJet M1132 MFP','85A',10,0,5),
(36,'HP','LaserJet P1102','85A',10,0,5),
(37,'HP','LaserJet P1102W','85A',10,0,5),
(38,'HP','Laser M1132 MFP','85A',10,0,5),
(39,'HP','LaserJet Pro P1102W','85A',10,0,5),
(40,'HP','LaserJet P1005','85A',10,0,5),
(41,'HP','LaserJet CP1025 Color','126A / Ce310A / 311A / 312A / 313A',0,1,5),
(42,'HP','LaserJet Pro 400 Color M451DW','305A / Ce410 / Ce411 / Ce412 / Ce413',0,1,5),
(43,'HP','MFP-E52645','W9008MC',3,1,5),
(44,'HP','DesignJet T120','544 Tank',6,0,5),
(45,'Lexmark','MS517DN','51B4H00',10,0,5),
(46,'Lexmark','MX310DN','60FBH00',10,0,5),
(47,'Samsung','Xpress M2875FD','MLT-D116',6,0,5),
(48,'Xerox','B210','B205 / B210 / 215',9,0,5),
(49,'Xerox','B230','LXB230L',6,0,5);

SELECT COUNT(*) as total FROM toners;
SELECT marca, COUNT(*) as qtd FROM toners GROUP BY marca ORDER BY qtd DESC;

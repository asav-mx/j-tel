-- Reversa de la 0037. Primero se revierte el CÓDIGO y después esto: el
-- archivador nuevo contra una base sin la tabla no archiva nada.
--
-- Borrar la tabla no borra ningún punto. Sólo se pierde hasta dónde se leyó
-- cada aparato, y el archivador viejo vuelve a su marca por cuenta.

DROP TABLE IF EXISTS telemetry_archive_marks;

import { XMLParser } from 'fast-xml-parser';
export function parseCfdi(xmlText){
  const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'', allowBooleanAttributes:true });
  const j = parser.parse(xmlText);
  const c = j['cfdi:Comprobante'] || j.Comprobante;
  if(!c) throw new Error('No es CFDI 4.0');
  const emisor = c['cfdi:Emisor'] || c.Emisor || {};
  const receptor = c['cfdi:Receptor'] || c.Receptor || {};
  const compl = c['cfdi:Complemento'] || c.Complemento || {};
  const tfd = compl['tfd:TimbreFiscalDigital'] || compl.TimbreFiscalDigital || {};
  const conceptosNode = c['cfdi:Conceptos'] || c.Conceptos || {};
  let conceptos = conceptosNode['cfdi:Concepto'] || conceptosNode.Concepto || [];
  if(!Array.isArray(conceptos)) conceptos = conceptos ? [conceptos] : [];
  return {
    fecha: c.Fecha, subtotal: parseFloat(c.SubTotal || c.Subtotal || 0), total: parseFloat(c.Total||0),
    usoCFDI: receptor.UsoCFDI || '', metodoPago: c.MetodoPago || '', formaPago: c.FormaPago || '',
    emisor: { rfc: emisor.Rfc || emisor.RFC || '', nombre: emisor.Nombre || '' },
    receptor: { rfc: receptor.Rfc || receptor.RFC || '', nombre: receptor.Nombre || '' },
    timbre: { uuid: tfd.UUID || null, fecha: tfd.FechaTimbrado || null },
    conceptos: conceptos.map(x=>({ claveProdServ:x.ClaveProdServ, claveUnidad:x.ClaveUnidad, descripcion:x.Descripcion, cantidad:parseFloat(x.Cantidad||0), valorUnitario:parseFloat(x.ValorUnitario||0), importe:parseFloat(x.Importe||0) }))
  };
}

// Conservative parsing: only explicit series/volume patterns, never bare title numbers.
export function extractSeriesMetadata(title){
 const value=String(title||'').trim()
 const patterns=[
  /^(.*?)\s*\(([^()]+?)\s*[,#]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)\)$/i,
  /^(.*?)\s*[-–:]\s*([^:()]+?)\s*[,#]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)$/i,
  /^(.*?)\s*\(([^()]+?)\s*[-–]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)\)$/i,
  /^(.*?)\s*\(([^()]+?)\s*#\s*([1-9]\d*(?:\.\d+)?)\)$/i
 ]
 for(const pattern of patterns){
  const match=value.match(pattern)
  if(match&&match[2].trim()&&match[1].trim())
   return {series:match[2].trim(),series_position:Number(match[3]),confidence:'explicit_title'}
 }
 return {series:'',series_position:null,confidence:'unknown'}
}

/**
 * Accept a series/volume suggestion only when the source supplies explicit
 * bibliographic series metadata. Never infer order from a book title or year.
 * Returns a candidate for user review, not a silently saved assignment.
 */
export function verifiedSeriesCandidate(record){
 const name=typeof record?.series==='string'?record.series.trim():''
 const position=typeof record?.series_position==='number'?record.series_position:NaN
 const source=typeof record?.source==='string'?record.source.trim():''
 const url=typeof record?.source_url==='string'?record.source_url.trim():''
 if(!name||!Number.isFinite(position)||position<=0||!source||!/^https:\/\//i.test(url))return null
 return {series:name,series_position:position,source,source_url:url,requires_confirmation:true}
}

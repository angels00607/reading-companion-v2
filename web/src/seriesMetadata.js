// Conservative parsing: only explicit series/volume patterns, never bare title numbers.
export function extractSeriesMetadata(title){
 const value=String(title||'').trim()
 const patterns=[
  /^(.*?)\s*\(([^()]+?)\s*[,#]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)\)$/i,
  /^(.*?)\s*[-–:]\s*([^:()]+?)\s*[,#]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)$/i,
  /^(.*?)\s*\(([^()]+?)\s*[-–]\s*(?:book|volume|vol\.?|tome)\s*#?([1-9]\d*(?:\.\d+)?)\)$/i
 ]
 for(const pattern of patterns){
  const match=value.match(pattern)
  if(match&&match[2].trim()&&match[1].trim())
   return {series:match[2].trim(),series_position:Number(match[3]),confidence:'explicit_title'}
 }
 return {series:'',series_position:null,confidence:'unknown'}
}

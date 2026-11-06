export type SearchMode='ids'|'preview';
export type DiscoveryPlace={id:string;name?:string;address?:string;attributions?:{provider:string;uri?:string}[]};
export function placeIds(places:DiscoveryPlace[]){return [...new Set(places.map(p=>p.id))];}
export function mapsLink(query:string,placeId?:string){const params=new URLSearchParams({api:'1',query});if(placeId)params.set('query_place_id',placeId);return 'https://www.google.com/maps/search/?'+params;}

import type { Metadata } from 'next';
import { EventGalleryClient } from './event-gallery-client';

export const metadata:Metadata={title:'Galerie événement KHE Booth',description:'Galerie privée des Moments KHE Booth de votre événement.',robots:{index:false,follow:false,nocache:true},referrer:'no-referrer'};
export default async function GuestEventPage({params}:{params:Promise<{token:string}>}){const{token}=await params;return <EventGalleryClient token={token}/>;}

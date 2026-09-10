import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
export interface SvgRenderOptions {width:number;height:number;transparent?:boolean}
const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
export class SvgRenderer {
  render(state:any,options:SvgRenderOptions){
    const {width,height}=options; const bg=state.entities?.find((e:any)=>e.type==="scene")?.components?.background?.color ?? "#87CEEB";
    const rect=options.transparent?"":`<rect width="100%" height="100%" fill="${bg}"/>`;
    const parts:string[]=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rect}`];
    const scale=state.camera?.zoom??1;
    for(const e of state.entities??[]){const p=e.transform?.position??{x:width/2,y:height/2,z:0};const c=e.components??{};const x=p.x||width/2,y=p.y||height/2;
      if(e.type==="character"){const skin=e.components?.skin??"#F1C7A8",hair=e.components?.hairColor??"#24170F",top=e.components?.topColor??"#3A6EA5";const smile=e.evaluation?.facial?.smile??0;const mouth=Math.max(6,12+smile*6);
        parts.push(`<g transform="translate(${x},${y}) scale(${scale})"><ellipse cx="0" cy="90" rx="42" ry="12" fill="#000" opacity=".15"/><rect x="-30" y="20" width="60" height="70" rx="18" fill="${top}"/><circle cx="0" cy="-25" r="48" fill="${skin}"/><path d="M-45-28 Q0-75 45-28 L38-58 Q0-88-38-58Z" fill="${hair}"/><circle cx="-17" cy="-25" r="6" fill="#222"/><circle cx="17" cy="-25" r="6" fill="#222"/><path d="M-18 5 Q0 ${5+mouth} 18 5" fill="none" stroke="#5A2630" stroke-width="5" stroke-linecap="round"/></g>`);
      } else if(e.type==="prop"){const w=c.width??100,h=c.height??60,color=c.color??"#9B6B43";parts.push(`<g><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="6" fill="${color}"/><text x="${x}" y="${y+5}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#fff">${esc(e.name)}</text></g>`);}
    }
    parts.push("</svg>"); return parts.join("");
  }
  async writeFrame(state:any,options:SvgRenderOptions,dir:string,name:string){const p=join(dir,name);await mkdir(dirname(p),{recursive:true});await writeFile(p,this.render(state,options),"utf8");return p;}
}

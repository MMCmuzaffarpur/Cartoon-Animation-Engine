import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256, CaeError, type ContentHash } from "../../domain/src/index.js";

export interface AssetRecord { assetId:string; contentHash:ContentHash; mimeType:string; byteSize:number; source:Record<string,unknown>; dependencyAssetIds:string[]; createdAt:string; }
export class AssetEngine {
  constructor(private readonly root:string) {}
  private path(hash:string){ return join(this.root,"sha256",hash.slice(0,2),hash.slice(2,4),hash); }
  async put(data:Buffer, mimeType="application/octet-stream", source:Record<string,unknown>={}):Promise<AssetRecord>{
    const contentHash=sha256(data), p=this.path(contentHash);
    await mkdir(join(this.root,"sha256",contentHash.slice(0,2),contentHash.slice(2,4)),{recursive:true});
    try{await stat(p)}catch{const tmp=p+".tmp";await writeFile(tmp,data);await rename(tmp,p);}
    return {assetId:contentHash,contentHash, mimeType, byteSize:data.byteLength, source, dependencyAssetIds:[], createdAt:new Date().toISOString()};
  }
  async get(hash:string){try{return await readFile(this.path(hash));}catch{throw new CaeError("ASSET_NOT_FOUND","Asset blob not found",[hash]);}}
  async exists(hash:string){try{await stat(this.path(hash));return true;}catch{return false;}}
  async verify(hash:string){return sha256(await this.get(hash))===hash;}
}

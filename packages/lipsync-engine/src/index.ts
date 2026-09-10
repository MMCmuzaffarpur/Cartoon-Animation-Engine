import { uuid } from "../../domain/src/index.js";
export const PHONEME_TO_VISEME:Record<string,string>={
  A:"AI",AA:"AI",AE:"AI",AH:"AI",AY:"AI",E:"E",EH:"E",EY:"E",I:"E",IH:"E",EE:"E",
  O:"O",AO:"O",OW:"O",UH:"U",UW:"U",OO:"U",B:"MBP",P:"MBP",M:"MBP",F:"FV",V:"FV",
  D:"DNTL",T:"DNTL",N:"DNTL",L:"DNTL",S:"SZ",Z:"SZ",SH:"SH",ZH:"SH",CH:"SH",JH:"SH",
  K:"KG",G:"KG",NG:"KG",R:"R",W:"U",Y:"E",HH:"REST",TH:"TH",DH:"TH",sil:"REST"
};
export interface PhonemeEvent{startTick:number;endTick:number;phoneme:string;confidence:number}
export class LipSyncEngine {
  analyzePhonemes(phonemes:PhonemeEvent[],language="en-IN"){
    const visemes=phonemes.map(p=>({startTick:p.startTick,endTick:p.endTick,viseme:PHONEME_TO_VISEME[p.phoneme.toUpperCase()]??"REST",weight:p.confidence}));
    return {id:uuid(),audioAssetId:null,language,analyzer:"phoneme-events",version:"1.0.0",phonemes,visemes,curves:[],alignmentVersion:"1.0.0",manualOverrides:[],provenance:{deterministic:true}};
  }
  fromWordTiming(words:{word:string;startTick:number;endTick:number}[],language="en-IN"){
    const phonemes:PhonemeEvent[]=words.map(w=>({startTick:w.startTick,endTick:w.endTick,phoneme:"sil",confidence:1}));
    return this.analyzePhonemes(phonemes,language);
  }
  visemeAt(track:any,tick:number){const hit=track.visemes.find((v:any)=>tick>=v.startTick&&tick<=v.endTick);return hit??{viseme:"REST",weight:0};}
}

import { getStore } from "@netlify/blobs";
const DUR = 150*60*1000, GRACE = 90*1000;
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const keyOf = (p,n) => norm(p+" "+n).split(" ").sort().join("-");
const J = (o,s=200) => new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json"}});
export default async (req) => {
  const store = getStore("devoir");
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\//,"");
  if (route === "results") {
    if (!process.env.ADMIN_KEY || url.searchParams.get("key") !== process.env.ADMIN_KEY) return J({error:"Clé invalide"},401);
    const {blobs} = await store.list(); const out = [];
    for (const b of blobs) { const r = await store.get(b.key,{type:"json"}); if (r) { delete r.token; out.push(r); } }
    return J(out);
  }
  if (req.method !== "POST") return J({error:"Méthode non autorisée"},405);
  const b = await req.json();
  const prenom = String(b.prenom||"").trim().slice(0,60), nom = String(b.nom||"").trim().slice(0,60);
  if (!prenom || !nom || !b.token) return J({error:"Nom et prénom requis."},400);
  const key = keyOf(prenom,nom), now = Date.now();
  const rec = await store.get(key,{type:"json"});
  if (route === "start") {
    if (!rec) { await store.setJSON(key,{prenom,nom,token:b.token,start:now,submitted:false}); return J({start:now,now}); }
    if (rec.token === b.token && !rec.submitted) return J({start:rec.start,now});
    return J({error:"Ce nom et prénom ont déjà été utilisés pour ce devoir. Connexion refusée."},409);
  }
  if (route === "submit") {
    if (!rec || rec.token !== b.token) return J({error:"Session invalide."},403);
    if (rec.submitted) return J({ok:true});
    rec.answers = b.answers; rec.submitted = true; rec.submittedAt = now; rec.late = now > rec.start+DUR+GRACE;
    await store.setJSON(key,rec); return J({ok:true});
  }
  return J({error:"Introuvable"},404);
};
export const config = { path: "/api/*" };

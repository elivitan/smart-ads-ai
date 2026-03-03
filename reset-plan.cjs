const{PrismaClient}=require("@prisma/client")
const p=new PrismaClient()
p.shopSubscription.updateMany({
  data:{plan:"free",scanCredits:0,aiCredits:0,maxProducts:3,maxCampaigns:0}
}).then(r=>{console.log("Reset to free:",r);return p.$disconnect()})

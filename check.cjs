const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.shopSubscription.findMany().then(r=>{console.log(JSON.stringify(r,null,2));p['\x24disconnect']()})

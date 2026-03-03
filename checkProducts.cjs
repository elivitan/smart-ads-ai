const{PrismaClient}=require('@prisma/client')
const p=new PrismaClient()
p.product.count().then(c=>{
  console.log('Products in DB:', c)
  return p.product.findMany({take:2,select:{id:true,title:true}})
}).then(r=>{
  console.log(r)
  p['\x24disconnect']()
})

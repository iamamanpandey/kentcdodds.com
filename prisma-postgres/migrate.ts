import {PrismaClient as SqliteClient} from '@prisma/client'
// eslint-disable-next-line import/no-extraneous-dependencies
import {PrismaClient as PostgresClient} from '@prisma/client-postgres'

// TIP: do not do this if you have lots of data... I don't
// copy all data from pg to sq
async function main() {
  if (process.env.FLY_REGION !== process.env.PRIMARY_REGION) {
    console.log('not primary region, skipping')
    return
  }

  const pg = new PostgresClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_DATABASE_URL,
      },
    },
  })
  const sq = new SqliteClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
  await pg.$connect()
  await sq.$connect()

  const users = await pg.user.findMany()
  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    await sq.user.upsert({where: {id: user.id}, update: user, create: user})
  }

  const sessions = await pg.session.findMany()
  for (const session of sessions) {
    // eslint-disable-next-line no-await-in-loop
    await sq.session.upsert({
      where: {id: session.id},
      update: session,
      create: session,
    })
  }

  const postReads = await pg.postRead.findMany()
  for (const postRead of postReads) {
    // eslint-disable-next-line no-await-in-loop
    await sq.postRead.upsert({
      where: {id: postRead.id},
      update: postRead,
      create: postRead,
    })
  }

  const calls = await pg.call.findMany()
  for (const call of calls) {
    // eslint-disable-next-line no-await-in-loop
    await sq.call.upsert({where: {id: call.id}, update: call, create: call})
  }

  console.log('✅  all finished')

  await pg.$disconnect()
  await sq.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

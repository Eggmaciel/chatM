import express from "express"
import logger from "morgan"
import dotenv from "dotenv" //Para leer las variables de entorno
import { createClient } from '@libsql/client' //Crear el cliente sql 

import { Server } from 'socket.io'  
import { createServer} from 'node:http' //modulo para crear servidores http

dotenv.config()
const port = process.env.PORT ?? 3000 //Se establece un puerto el cual puede ser asignado del entorno 
//o por defecto el puerto 3000

const app = express() //Se inicializa la aplicación llamando a express 
const server = createServer(app) //Se crea el servidor http
const io = new Server(server, {
    connectionStateRecovery: {}
}) //Se crea servidor de web socket

//Se crea la conexion a la bd
const db = createClient({
    url: "libsql://rational-blood-wraith-alejandromacieldominguez.turso.io",
    authToken: process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
`)

//Cuando el io tenga una conexión se llama al callback
io.on('connection', async (socket)=> {
    console.log(socket.handshake.auth)

    socket.on('disconnect', () => {
        console.log(' an user has disconnected')
    })

    socket.on('chat message', async (msg) =>{
        let result
        const username = socket.handshake.auth.username ?? 'anonymous'
        try {
            
             result = await db.execute({
                sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
                args: { msg, username}
             })
        }catch(e){
            console.error(e)
            return
        }
    
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })

    if(!socket.recovered){ //Si no se a podido recuperar
        try{
            const result = await db.execute({
                sql: 'SELECT id, content, user FROM messages WHERE id > ?',
                args: ['0']
            })
            
            result.rows.forEach(row =>{
                socket.emit('chat message', row.content, row.id.toString(), row.user.toString())
            })
        }catch(e){
            console.error(e)
            return
        }
    }
})

app.use(logger('dev'))

app.get('/',(req, res) => {
    res.sendFile(process.cwd() + '/cliente/index.html') //Se sirve el documento donde esta el char con el process.cwd(current working directory)
})

server.listen(port, () => {
    console.log(`Server running on port ${port}`)
})
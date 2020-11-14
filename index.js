const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server,{
    cors : {
        origin : true
    }
})
const bodyParser = require('body-parser');
const {randomBytes} = require('crypto');

const rooms = {};
const connectedSockets = {}

app.use(bodyParser.json());
app.use(cors());

app.post('/createRoom',function createRoom(req,res) {
    console.log('attempting create')

    randomBytes(48,function cb(err,buf) {
        if(err){
            console.log('create failed for server')

            res.status(500).json({
                message : "UNEXPECTED ERROR"
            });

        }else{
            const room = buf.toString('base64').replace(/\//g,'_').replace(/\+/g,'-');
            const name = req.body.name;
            const socketId = req.body.socketId;

            if(

                typeof name !== 'string'     ||
                name.length < 2              ||
                name.length > 10             ||

                typeof socketId !== 'string' ||
                connectedSockets[socketId] === undefined

            ){
                console.log('create failed for input')

                res.status(422).json({
                    message : "invalid input"
                });

            }else{
                console.log('successful create');

                rooms[room] = [{
                    name,
                    socketId
                }];

                res.status(201).json({
                    message : "room created successfully",
                    room
                });

                const socket = connectedSockets[socketId];
                socket.join(room);

            } 
        }
    })
});

app.post('/joinRoom',function joinRoom(req,res) {
    console.log('join attempt')

    const room = req.body.room;
    const name = req.body.name;
    const socketId = req.body.socketId;

    if(

        typeof room !== 'string'     ||
        room.length !== 64           ||
        rooms[room] === undefined    ||
        rooms[room].length >= 5      ||

        typeof name !== 'string'     ||
        name.length < 2              ||
        name.length > 10             ||

        typeof socketId !== 'string' ||
        connectedSockets[socketId] === undefined

    ){
        console.log('unsuccessful join attempt')

        res.status(422).json({
            message : 'invalid input'
        });

    }else{
        console.log('successful join attempt');

        const users = rooms[room];
        
        const socket = connectedSockets[socketId];
        socket.broadcast.to(room).emit('userJoined',{
            name,
            socketId
        });
        socket.join(room);
        
        socket.on('disconnect',()=>{
            connectedSockets[socketId] === undefined;
            socket.broadcast.to(room).emit('userLeft',{
                name,
                socketId
            });
        });

        res.status(200).json({
            message : "joined successfully",
            users
        })

        rooms[room].push({
            name,
            socketId
        });
    }

});

io.on('connection',socket => {
    const socketId = socket.id;
    const doExist = connectedSockets[socketId] !== undefined;

    if(!doExist) connectedSockets[socketId] = socket;

    socket.on('createOffer',(data,ack)=>{
        if(
            data.offer === undefined ||

            typeof data.to !== 'string' ||
            connectedSockets[data.to] === undefined 

        ){
            ack(new Error('invalid input'));
        }else{
            const rcpt = connectedSockets[data.to];
            const offer = data.offer;
            rcpt.emit('offerCreated',{offer,socketId});
        }
    });

    socket.on('createAnswer',(data,ack)=>{
        if(
            data.answer === undefined ||

            typeof data.to !== 'string' ||
            connectedSockets[data.to] === undefined
        ){
            ack(new Error('invalid input'))
        }else{
            const rcpt = connectedSockets[data.to];
            const answer = data.answer;
            rcpt.emit('answerCreated',{answer,socketId});
        }
    })
});

server.listen(port,()=> console.log(`Server has started at ${port}`));
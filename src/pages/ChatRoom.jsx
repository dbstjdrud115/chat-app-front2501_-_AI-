import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom'
import ReactLoading from 'react-loading'
import axios from 'axios'
import { toast } from 'react-toastify'
import { mockChats } from '../mocks/data'

import SockJS from 'sockjs-client'
import { Stomp } from '@stomp/stompjs'



function    ChatRoom() {
    const { roomId } = useParams()
    const [messages, setMessages] = useState([])     //서버에서 받은 전체 메시지 데이터양
    const [newMessage, setNewMessage] = useState('') //메세지 입력칸. 입력마다 set이벤트 수행
    const [authorName, setAuthorName] = useState('')
    const [loading, setLoading] = useState(true)
    const [connected, setConnected] = useState(false)
    const messagesEndRef = useRef(null)
    const wsRef = useRef(null)

    const [messageId, setMessageId] = useState("0");
    //react hook의 일부인 useRef는 값이 바뀌어도 리렌더링 안됨.
    //특정 컴포넌트에 <div ref={messagesEndRef} /> useRef를 걸어두어, 접근 가능.

    
    const fetchInitialMessages = async () => {

        //이유는 모르겠는데 이상하게 화면이 두번호출됨.
        console.log("fetchInitialMessages 실행됨");

        try {
            const response = await axios.get(`http://localhost:8070/api/v1/chat/rooms/${roomId}/messages?afterChatMessageId=${messageId}`)
            if (response.data.data && response.data.data.length > 0) {
                setMessages(response.data.data)
            }
        } catch (error) {
            console.error('Error fetching initial messages:', error)
            setMessages(mockChats)
            toast.warning('테스트 데이터를 표시합니다.')
        } finally {
            setLoading(false)
        }
    }
    
    // WebSocket 연결 설정
    const connectWebSocket = () => {
        console.log("connectWebSocket 실행됨");
        try {
              const ws = new WebSocket(`ws://localhost:8070/ws/chat/${roomId}/messages?afterChatMessageId=${messageId}`)
           

            // 
            ws.onopen = () => {
                console.log('WebSocket Connected')
                setConnected(true)
            }

            //서버가 클라에게 데이터 회신할때 발생
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data)
                setMessages((prev) => [...prev, message])
            }

            //통신 종료시
            ws.onclose = () => {
                console.log('WebSocket Disconnected')
                setConnected(false)
                // 연결이 끊어졌을 때 10초 후 재연결 시도
                // setTimeout(connectWebSocket, 10000)
            }

            //통신도중 에러발생
            ws.onerror = (error) => {
                console.error('WebSocket Error:', error)
                toast.error('채팅 연결에 문제가 발생했습니다.')
            }

            wsRef.current = ws
        } catch (error) {
            console.error('WebSocket connection error:', error)
            toast.error('채팅 연결에 실패했습니다.')
        }
    }

    // 컴포넌트 마운트 시 초기화
    useEffect(() => {

        console.log("useEffect 실행됨");
        
        fetchInitialMessages()
        connectWebSocket()     //웹소켓 연결

        // 컴포넌트 언마운트 시 WebSocket 연결 종료
        // 여기 언저리에서 처음 호출때 에러난다.
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [roomId])

    // 새 메시지 수신 시 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])



    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || !authorName.trim()) return

        const newChat = {
            id: `msg${messages.length + 1}`,
            content: newMessage,
            author: authorName,
            createDate: new Date().toISOString(),
            isMyMessage: true,
        }

        try {
            if (connected && wsRef.current) {
                wsRef.current.send(
                    JSON.stringify({
                        roomId,     //종속된 채팅방정보
                        content: newMessage,
                        author: authorName,
                    }),
                )
            } else {
                // WebSocket 연결이 없을 경우 HTTP API로 폴백
                await axios.post(`http://localhost:8070/api/v1/chat/rooms/${roomId}/messages`, {
                    content: newMessage,
                    author: authorName,
                })
            }
            // UI 즉시 업데이트
            setMessages((prev) => [...prev, newChat])
        } catch (error) {
            console.error('Error sending message:', error)
            // 에러 발생시에도 UI 업데이트
            setMessages((prev) => [...prev, newChat])
            toast.warning('테스트 모드로 작동합니다.')
        }

        setNewMessage('')
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <ReactLoading type="spin" color="#4F46E5" height={50} width={50} className="mx-auto mb-4" />
                    <p className="text-gray-600">로딩중...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-indigo-600 text-white p-4">
                    <h1 className="text-xl font-bold">DATA BLOCKS 채팅방</h1>
                    <p className="text-sm opacity-75">Backend Developer들과의 대화</p>
                </div>

                <div className="h-[600px] overflow-y-auto p-4 bg-gray-50">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id} //isMyMessage를 설정하려면 유저정보가 필요한데..이건 정말나중에..
                                className={`flex flex-col ${message.isMyMessage ? 'items-end' : 'items-start'}`}
                            >
                                <span className="text-sm font-medium text-gray-600 mb-1 px-2">
                                    {message.writerName || '익명'}
                                </span>
                                <div
                                    className={`max-w-[70%] ${
                                        message.isMyMessage
                                            ? 'bg-indigo-500 text-white rounded-l-lg rounded-tr-lg'
                                            : 'bg-white text-gray-800 rounded-r-lg rounded-tl-lg'
                                    } p-3 shadow-md`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <p className="text-xs text-right mt-1 opacity-75">
                                        {new Date(message.createDate).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            placeholder="작성자 이름"
                            className="w-1/4 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            전송
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ChatRoom
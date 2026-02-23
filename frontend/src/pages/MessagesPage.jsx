import { useState, useEffect } from "react";
import { Send, MessageSquare, User, Circle } from "lucide-react";
import { messageService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import AdminSidebar from "../components/AdminSidebar";

const MessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setOnlineUsers([]);
      setSelectedConversation(null);
      setMessages([]);
      setLoading(false);
      return;
    }

    fetchConversations();
    fetchOnlineUsers();
    // Poll for online users every 5 seconds
    const interval = setInterval(fetchOnlineUsers, 5000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const data = await messageService.getConversations();
      setConversations(data);
      if (data.length > 0) {
        setSelectedConversation(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const data = await messageService.getOnlineUsers();
      setOnlineUsers(data);
    } catch (error) {
      console.error("Failed to fetch online users:", error);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const data = await messageService.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await messageService.send({
        conversationId: selectedConversation.id,
        recipientId: selectedConversation.otherUser.id,
        message: newMessage,
      });
      setNewMessage("");
      fetchMessages(selectedConversation.id);
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const isUserOnline = (userId) => {
    return onlineUsers.some((u) => u.id === userId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user.role === "admin" ? (
        <AdminSidebar />
      ) : user.role === "owner" ? (
        <OwnerSidebar />
      ) : (
        <RenterSidebar />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-2"></p>
        </div>

        <div className="card overflow-hidden">
          <div className="grid md:grid-cols-4 h-[600px]">
            {/* Online Users & Conversations */}
            <div className="md:col-span-1 border-r border-gray-200 overflow-y-auto flex flex-col">
              {/* Online Users Section */}
              <div className="border-b border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900 flex items-center">
                    <Circle className="h-4 w-4 text-green-500 mr-2" />
                    Online ({onlineUsers.length})
                  </h2>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {onlineUsers.length > 0 ? (
                    onlineUsers.map((onlineUser) => (
                      <div
                        key={onlineUser.id}
                        className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {onlineUser.fullName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {onlineUser.role}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No users online
                    </div>
                  )}
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">Conversations</h2>
                </div>
                {conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                        selectedConversation?.id === conv.id
                          ? "bg-primary-50"
                          : ""
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white">
                            <User className="h-5 w-5" />
                          </div>
                          {isUserOnline(conv.otherUser?.id) && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.otherUser?.fullName || "Unknown User"}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {conv.lastMessage || "No messages yet"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No conversations yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="md:col-span-3 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {selectedConversation.otherUser?.fullName ||
                            "Unknown User"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.otherUser?.role || "User"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderId === user.id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            msg.senderId === user.id
                              ? "bg-primary-600 text-white"
                              : "bg-gray-200 text-gray-900"
                          }`}
                        >
                          <p>{msg.message}</p>
                          <p className="text-xs mt-1 opacity-75">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-4 border-t border-gray-200"
                  >
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="input-field flex-1"
                      />
                      <button type="submit" className="btn-primary">
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-3 text-gray-300" />
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MessagesPage;

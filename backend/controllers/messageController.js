import { supabase } from '../config/supabase.js';

// Get online users
export const getOnlineUsers = async (req, res) => {
  try {
    // Get users who have been active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, updated_at')
      .gt('updated_at', fiveMinutesAgo.toISOString())
      .neq('id', req.user.id); // Exclude current user

    if (error) throw error;

    const onlineUsers = data.map(user => ({
      id: user.id,
      fullName: user.full_name,
      role: user.role,
    }));

    res.json(onlineUsers);
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const { recipientId, message, conversationId } = req.body;

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: req.user.id,
          recipient_id: recipientId,
          message,
          conversation_id: conversationId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Message sent successfully',
      data,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get conversations
export const getConversations = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!sender_id(*), recipient:users!recipient_id(*)')
      .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation
    const conversations = [];
    const seenUsers = new Set();

    data.forEach(msg => {
      const otherUserId = msg.sender_id === req.user.id ? msg.recipient_id : msg.sender_id;
      
      if (!seenUsers.has(otherUserId)) {
        seenUsers.add(otherUserId);
        conversations.push({
          id: `conv_${otherUserId}`,
          otherUser: msg.sender_id === req.user.id ? msg.recipient : msg.sender,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
        });
      }
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages in conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Extract user ID from conversation ID
    const otherUserId = conversationId.replace('conv_', '');

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${req.user.id})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

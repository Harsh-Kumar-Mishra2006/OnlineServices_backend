const urgencyLevels = [
  {
    id: 'urgent',
    label: '🚨 Urgent - Within 1 Hour',
    timeframe: 'Within 1 hour',
    priority: 5,
    color: '#FF0000',
    description: 'Emergency issue requiring immediate attention'
  },
  {
    id: 'very_high',
    label: '⏰ Very High - 2-3 Hours',
    timeframe: '2-3 hours',
    priority: 4,
    color: '#FF4444',
    description: 'Very urgent, needs quick response'
  },
  {
    id: 'high',
    label: '⚡ High - 4-6 Hours',
    timeframe: '4-6 hours',
    priority: 3,
    color: '#FF8800',
    description: 'High priority, same day service'
  },
  {
    id: 'medium',
    label: '📅 Medium - Today',
    timeframe: 'Today (anytime)',
    priority: 2,
    color: '#FFAA00',
    description: 'Can be done anytime today'
  },
  {
    id: 'low',
    label: '🐢 Low - 1-2 Days',
    timeframe: '1-2 days',
    priority: 1,
    color: '#44AA44',
    description: 'Can wait 1-2 days'
  },
  {
    id: 'flexible',
    label: '🌿 Flexible - 3-5 Days',
    timeframe: '3-5 days',
    priority: 0,
    color: '#888888',
    description: 'No rush, flexible scheduling'
  }
];

module.exports = urgencyLevels;
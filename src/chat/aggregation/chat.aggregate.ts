import * as mongoose from 'mongoose';
import { PipelineStage } from 'mongoose';

export const aggregateGetAllChat = (from, to): PipelineStage[] => [
  {
    $lookup: {
      from: 'users',
      localField: 'from',
      foreignField: '_id',
      pipeline: [
        {
          $project: {
            name: 1,
            avatar: '$profileImage',
            isAllChatRead: 1,
          },
        },
      ],
      as: 'user',
    },
  },
  {
    $unwind: {
      path: '$user',
    },
  },
  {
    $match: {
      // from: new ObjectId('637f6d58212cb8b2918f55ec'),//steve
      // to: new ObjectId('63721ea6df438844d83fdab6')//alfonso
      $or: [
        {
          $and: [
            { from: new mongoose.Types.ObjectId(from) },
            { to: new mongoose.Types.ObjectId(to) },
          ],
        },
        {
          $and: [
            { from: new mongoose.Types.ObjectId(to) },
            { to: new mongoose.Types.ObjectId(from) },
          ],
        },
      ],
    },
  },
  {
    $project: {
      user: 1,
      createdAt: 1,
      _id: '$_id',
      text: '$message',
      received: '$isRead',
    },
  },

  {
    $sort: {
      createdAt: -1,
    },
  },
];

import { PipelineStage } from 'mongoose';
import { ObjectId } from 'bson';

export const aggregateUserNotificationListing = (query, pageination) =>
  [
    {
      $match: {
        to: new ObjectId(query.to),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'from',
        foreignField: '_id',
        as: 'from',
      },
    },
    {
      $unwind: {
        path: '$from',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'to',
        foreignField: '_id',
        as: 'to',
      },
    },
    {
      $unwind: {
        path: '$to',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        isBlocked: {
          $cond: {
            if: {
              $gt: [
                {
                  $indexOfArray: [
                    '$from.blockedUsersList',
                    new ObjectId(query.to),
                  ],
                },
                -1,
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $lookup: {
        from: 'events',
        localField: 'eventId',
        foreignField: '_id',
        as: 'eventId',
      },
    },
    {
      $unwind: {
        path: '$eventId',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        from: {
          profileImage: '$from.profileImage',
          name: '$from.name',
          email: '$from.email',
          _id: '$from._id',
        },
        // eventId: {
        //   name: '$eventId.name',
        // },
        to: '$to._id',
        isBlocked: 1,
        eventId: {
          name: '$eventId.name',
          _id: '$eventId._id',
        },
        message: '$message',
        createdAt: '$createdAt',
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        metadata: [
          { $count: 'count' },
          {
            $addFields: {
              page: pageination?.page,
              totalPages: {
                $ceil: {
                  $divide: ['$count', pageination.limit],
                },
              },
              limit: pageination.limit,
            },
          },
        ],
        data: [
          { $skip: (pageination?.page - 1) * pageination?.limit },
          { $limit: pageination?.limit },
        ], // add projection here wish you re-shape the docs
      },
    },
  ] as PipelineStage[];

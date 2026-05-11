import { FilterQuery } from 'mongoose';
import { EventTicketsDocument } from '../../../schemas/event.tickets.schema';
import * as mongoose from 'mongoose';
import { ObjectId } from 'bson';
import { UserDocument, userPublicFields } from '@src/schemas/user.shema';

export const aggregateEventTicket = (
  filter: FilterQuery<EventTicketsDocument>,
  me: UserDocument,
) => [
  {
    $match: {
      eventId: new mongoose.Types.ObjectId(filter.eventId),
      userId: { $ne: new mongoose.Types.ObjectId(filter.userId) },
    },
  },
  {
    $group: {
      _id: '$userId',
      userId: {
        $first: '$userId',
      },
      doc: {
        $first: '$$ROOT',
      },
    },
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: ['$doc'],
      },
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      pipeline: [
        {
          $addFields: {
            blockedByHim: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $indexOfArray: [
                        '$blockedUsersList',
                        new ObjectId(filter.userId),
                      ],
                    },
                    -1,
                  ],
                },
                then: true,
                else: false,
              },
            },
            blockedByMe: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $indexOfArray: [
                        me.blockedUsersList, //my blocklist
                        '$_id',
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
          $project: {
            ...userPublicFields,
            blockedByMe: 1,
            blockedByHim: 1,
          },
        },
      ],
      as: 'userId',
    },
  },
  {
    $unwind: {
      path: '$userId',
    },
  },
  {
    $project: {
      userId: {
        $mergeObjects: ['$userId', { isActive: '$userId.profileStatus' }],
      },
    },
  },
  {
    $lookup: {
      from: 'chat',
      let: { userId: '$userId._id' },
      pipeline: [
        {
          $match: {
            // "to": ObjectId("6398216c8762d27f593f8780")
            $expr: {
              $and: [
                {
                  $eq: ['$to', new mongoose.Types.ObjectId(filter.userId)],
                },
                {
                  $eq: ['$from', '$$userId'],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            unReadCount: {
              $sum: {
                $cond: {
                  if: {
                    $eq: ['$isRead', false],
                  },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      ],
      as: 'chat',
    },
  },
  {
    $unwind: {
      path: '$chat',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: ['$userId', { unReadCount: '$chat.unReadCount' }],
      },
    },
  },
];

export const aggregateEventTicketsGroupByEvent = (
  query: FilterQuery<EventTicketsDocument>,
) => [
  {
    $lookup: {
      from: 'events',
      localField: 'eventId',
      foreignField: '_id',
      pipeline: [
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: {
            path: '$category',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            'category.name': 1,
            name: 1,
            date: 1,
            price: 1,
            location: 1,
          },
        },
      ],
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
    $lookup: {
      from: 'payments',
      localField: 'paymentId',
      foreignField: '_id',
      as: 'paymentId',
    },
  },
  {
    $unwind: {
      path: '$paymentId',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $match: query,
  },
  {
    $group: {
      _id: '$eventId',
      tickets: {
        $addToSet: '$$ROOT',
      },
      noOfTicketsPurchased: {
        $sum: '$$ROOT.paymentId.noOfItems',
      },
      totalPrice: {
        $sum: '$$ROOT.paymentId.totalPrice',
      },
    },
  },
  {
    $addFields: {
      sortedTickets: {
        $sortArray: {
          input: '$tickets',
          sortBy: {
            createdAt: -1,
          },
        },
      },
    },
  },
  {
    $addFields: {
      lastTicket: {
        $arrayElemAt: ['$sortedTickets', 0],
      },
    },
  },
  {
    $project: {
      _id: 0,
      event: '$_id',
      tickets: '$tickets',
      count: {
        $size: '$tickets',
      },
      noOfTicketsPurchased: 1,
      totalPrice: 1,
      lastTicketPurchasedOn: '$lastTicket.createdAt',
    },
  },
];

export const aggregateEventEarning = (id) => [
  {
    /**
     * from: The target collection.
     * localField: The local join field.
     * foreignField: The target join field.
     * as: The name for the results.
     * pipeline: Optional pipeline to run on the foreign collection.
     * let: Optional variables to use in the pipeline field stages.
     */
    $lookup: {
      from: 'payments',
      localField: 'paymentId',
      foreignField: '_id',
      as: 'payment',
    },
  },
  {
    /**
     * path: Path to the array field.
     * includeArrayIndex: Optional name for index.
     * preserveNullAndEmptyArrays: Optional
     *   toggle to unwind null and empty values.
     */
    $unwind: {
      path: '$payment',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    /**
     * query: The query in MQL.
     */
    $match: {
      eventId: new ObjectId(id),
    },
  },
  {
    /**
     * newField: The new field name.
     * expression: The new field expression.
     */
    $addFields: {
      adminCommission: {
        $multiply: ['$commission', '$payment.totalPrice', 0.01],
      },
      vendorCommission: {
        $subtract: [
          '$payment.totalPrice',
          {
            $multiply: ['$commission', '$payment.totalPrice', 0.01],
          },
        ],
      },
      total: '$payment.totalPrice',
    },
  },
  {
    /**
     * _id: The id of the group.
     * fieldN: The first field name.
     */
    $group: {
      _id: '$eventId',
      grandTotal: {
        $sum: '$total',
      },
      adminEarning: {
        $sum: '$adminCommission',
      },
      vendorEarning: {
        $sum: '$vendorCommission',
      },
    },
  },
];

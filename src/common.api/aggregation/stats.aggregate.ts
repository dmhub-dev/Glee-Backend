import { PipelineStage } from 'mongoose';

export const eventEarningStatsAggregation = () =>
  [
    {
      $lookup: {
        from: 'event-tickets',
        localField: '_id',
        foreignField: 'eventId',
        as: 'tickets',
      },
    },
    {
      $project: {
        tickets: 1,
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $group: {
        _id: null,
        tickets: {
          $addToSet: '$tickets',
        },
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: 'tickets.paymentId',
        foreignField: '_id',
        as: 'payment',
      },
    },
    {
      $unwind: {
        path: '$payment',
      },
    },
    {
      $group: {
        _id: null,
        totalEarning: {
          $sum: {
            $multiply: ['$payment.totalPrice', '$tickets.commission', 0.01],
          },
        },
      },
    },
  ] as PipelineStage[];
export const serviceEarningStatsAggregation = () =>
  [
    {
      $lookup: {
        from: 'purchasedservices',
        localField: '_id',
        foreignField: 'serviceId',
        as: 'tickets',
      },
    },
    {
      $project: {
        tickets: 1,
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $group: {
        _id: null,
        tickets: {
          $addToSet: '$tickets',
        },
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: 'tickets.paymentId',
        foreignField: '_id',
        as: 'payment',
      },
    },
    {
      $unwind: {
        path: '$payment',
      },
    },
    {
      $group: {
        _id: null,
        totalEarning: {
          $sum: {
            $multiply: ['$payment.totalPrice', '$tickets.commission', 0.01],
          },
        },
      },
    },
  ] as PipelineStage[];

export const bookingEarningStatsAggregation = () =>
  [
    {
      $lookup: {
        from: 'purchasedbookings',
        localField: '_id',
        foreignField: 'bookingId',
        as: 'tickets',
      },
    },
    {
      $project: {
        tickets: 1,
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $group: {
        _id: null,
        tickets: {
          $addToSet: '$tickets',
        },
      },
    },
    {
      $unwind: {
        path: '$tickets',
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: 'tickets.paymentId',
        foreignField: '_id',
        as: 'payment',
      },
    },
    {
      $unwind: {
        path: '$payment',
      },
    },
    {
      $group: {
        _id: null,
        totalEarning: {
          $sum: {
            $multiply: ['$payment.totalPrice', '$tickets.commission', 0.01],
          },
        },
      },
    },
  ] as PipelineStage[];

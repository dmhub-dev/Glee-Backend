import { FilterQuery, PipelineStage } from 'mongoose';
import { VendorDocument } from '../../schemas/vendor.schema';

import * as mongoose from 'mongoose';

export const vendorAggregation = (
  query: FilterQuery<VendorDocument>,
  pagination?: { page: number; limit: number },
) => [
  {
    $match: query,
  },
  {
    $lookup: {
      from: 'events',
      localField: '_id',
      foreignField: 'vendor',
      pipeline: [
        {
          $lookup: {
            from: 'event-tickets',
            localField: '_id',
            foreignField: 'eventId',
            pipeline: [
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'payment',
                },
              },
              {
                $unwind: {
                  path: '$payment',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            as: 'purchased',
          },
        },
        {
          $addFields: {
            total: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: ['$$value', '$$this.payment.totalPrice'],
                },
              },
            },
            adminCommission: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: [
                    '$$value',
                    {
                      $multiply: [
                        '$$this.payment.totalPrice',
                        '$$this.commission',
                        0.01,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $set: {
            vendorCommission: {
              $subtract: ['$total', '$adminCommission'],
            },
          },
        },
      ],
      as: 'events',
    },
  },
  {
    $lookup: {
      from: 'services',
      localField: '_id',
      foreignField: 'vendor',
      pipeline: [
        {
          $lookup: {
            from: 'purchasedservices',
            localField: '_id',
            foreignField: 'serviceId',
            pipeline: [
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'payment',
                },
              },
              {
                $unwind: {
                  path: '$payment',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            as: 'purchased',
          },
        },
        {
          $addFields: {
            total: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: ['$$value', '$$this.payment.totalPrice'],
                },
              },
            },
            adminCommission: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: [
                    '$$value',
                    {
                      $multiply: [
                        '$$this.payment.totalPrice',
                        '$$this.commission',
                        0.01,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $set: {
            vendorCommission: {
              $subtract: ['$total', '$adminCommission'],
            },
          },
        },
      ],
      as: 'services',
    },
  },
  {
    $lookup: {
      from: 'bookings',
      localField: '_id',
      foreignField: 'vendor',
      pipeline: [
        {
          $lookup: {
            from: 'purchasedbookings',
            localField: '_id',
            foreignField: 'bookingId',
            pipeline: [
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'payment',
                },
              },
              {
                $unwind: {
                  path: '$payment',
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            as: 'purchased',
          },
        },
        {
          $addFields: {
            total: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: ['$$value', '$$this.payment.totalPrice'],
                },
              },
            },
            adminCommission: {
              $reduce: {
                input: '$purchased',
                initialValue: 0,
                in: {
                  $sum: [
                    '$$value',
                    {
                      $multiply: [
                        '$$this.payment.totalPrice',
                        '$$this.commission',
                        0.01,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $set: {
            vendorCommission: {
              $subtract: ['$total', '$adminCommission'],
            },
          },
        },
      ],
      as: 'bookings',
    },
  },
  {
    $set: {
      totalEvents: {
        $size: '$events',
      },
      totalServices: {
        $size: '$services',
      },
      totalBooking: {
        $size: '$bookings',
      },
      totalEarning: {
        $reduce: {
          input: '$events',
          initialValue: 0,
          in: {
            $sum: ['$$value', '$$this.vendorCommission'],
          },
        },
      },
    },
  },
  {
    $set: {
      totalEarning: {
        $reduce: {
          input: '$services',
          initialValue: '$totalEarning',
          in: {
            $sum: ['$$value', '$$this.vendorCommission'],
          },
        },
      },
    },
  },
  {
    $set: {
      totalEarning: {
        $reduce: {
          input: '$bookings',
          initialValue: '$totalEarning',
          in: {
            $sum: ['$$value', '$$this.vendorCommission'],
          },
        },
      },
    },
  },
  {
    $project: {
      _id: 1,
      name: 1,
      email: 1,
      totalEarning: 1,
      totalEvents: 1,
      totalServices: 1,
      totalBooking: 1,
      // adminMargin: {
      //     $multiply: ['$totalEarning', '$admin.otp'],
      // },
    },
  },
  {
    $facet: {
      metadata: [
        { $count: 'total' },
        { $addFields: { page: pagination.page } },
      ],
      data: [
        { $skip: (pagination.page - 1) * pagination.limit },
        { $limit: pagination.limit },
      ], // add projection here wish you re-shape the docs
    },
  },
];

export const ticketListingAggregation = (vendorId: string): PipelineStage[] => [
  {
    $facet: {
      events: [
        {
          $lookup: {
            from: 'event-tickets',
            pipeline: [
              {
                $lookup: {
                  from: 'events',
                  localField: 'eventId',
                  foreignField: '_id',
                  as: 'eventDetail',
                },
              },
              {
                $unwind: {
                  path: '$eventDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'paymentDetail',
                },
              },
              {
                $unwind: {
                  path: '$paymentDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userDetail',
                },
              },
              {
                $unwind: {
                  path: '$userDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $match: {
                  'eventDetail.vendor': new mongoose.Types.ObjectId(vendorId),
                },
              },
              {
                $project: {
                  type: 'EVENT',
                  itemDetail: {
                    name: '$eventDetail.name',
                    date: '$eventDetail.date.start',
                  },
                  userDetail: {
                    name: '$userDetail.name',
                  },
                  paymentDetail: {
                    totalPrice: '$paymentDetail.totalPrice',
                    noOfItems: '$paymentDetail.noOfItems',
                  },
                  purchasedOn: '$paymentDetail.createdAt',
                  adminShare: {
                    $multiply: [
                      '$paymentDetail.totalPrice',
                      '$commission',
                      0.01,
                    ],
                  },
                },
              },
              {
                $set: {
                  vendorShare: {
                    $round: [
                      {
                        $subtract: ['$paymentDetail.totalPrice', '$adminShare'],
                      },
                      1,
                    ],
                  },
                },
              },
              {
                $sort: {
                  purchasedOn: -1,
                },
              },
            ],
            as: 'eventHistory',
          },
        },
        {
          $match: {
            _id: new mongoose.Types.ObjectId(vendorId),
          },
        },
      ],
      services: [
        {
          $lookup: {
            from: 'purchasedservices',
            pipeline: [
              {
                $lookup: {
                  from: 'services',
                  localField: 'serviceId',
                  foreignField: '_id',
                  as: 'serviceDetail',
                },
              },
              {
                $unwind: {
                  path: '$serviceDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'paymentDetail',
                },
              },
              {
                $unwind: {
                  path: '$paymentDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userDetail',
                },
              },
              {
                $unwind: {
                  path: '$userDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $match: {
                  'serviceDetail.vendor': new mongoose.Types.ObjectId(vendorId),
                },
              },
              {
                $project: {
                  type: 'SERVICE',
                  itemDetail: {
                    name: '$serviceDetail.name',
                    date: '$serviceDetail.date',
                  },
                  userDetail: {
                    name: '$userDetail.name',
                  },
                  paymentDetail: {
                    totalPrice: '$paymentDetail.totalPrice',
                    noOfItems: '$paymentDetail.noOfItems',
                  },
                  purchasedOn: '$paymentDetail.createdAt',
                  adminShare: {
                    $multiply: [
                      '$paymentDetail.totalPrice',
                      '$commission',
                      0.01,
                    ],
                  },
                },
              },
              {
                $set: {
                  vendorShare: {
                    $round: [
                      {
                        $subtract: ['$paymentDetail.totalPrice', '$adminShare'],
                      },
                      1,
                    ],
                  },
                },
              },
              {
                $sort: {
                  purchasedOn: -1,
                },
              },
            ],
            as: 'serviceHistory',
          },
        },
        {
          $match: {
            _id: new mongoose.Types.ObjectId(vendorId),
          },
        },
      ],
      bookings: [
        {
          $lookup: {
            from: 'purchasedbookings',
            pipeline: [
              {
                $lookup: {
                  from: 'bookings',
                  localField: 'bookingId',
                  foreignField: '_id',
                  as: 'bookingDetail',
                },
              },
              {
                $unwind: {
                  path: '$bookingDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'payments',
                  localField: 'paymentId',
                  foreignField: '_id',
                  as: 'paymentDetail',
                },
              },
              {
                $unwind: {
                  path: '$paymentDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userDetail',
                },
              },
              {
                $unwind: {
                  path: '$userDetail',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $match: {
                  'bookingDetail.vendor': new mongoose.Types.ObjectId(vendorId),
                },
              },
              {
                $project: {
                  type: 'BOOKING',
                  itemDetail: {
                    name: '$bookingDetail.name',
                    date: '$bookingDetail.date',
                  },
                  userDetail: {
                    name: '$userDetail.name',
                  },
                  paymentDetail: {
                    totalPrice: '$paymentDetail.totalPrice',
                    noOfItems: '$paymentDetail.noOfItems',
                  },
                  purchasedOn: '$paymentDetail.createdAt',
                  adminShare: {
                    $multiply: [
                      '$paymentDetail.totalPrice',
                      '$commission',
                      0.01,
                    ],
                  },
                },
              },
              {
                $set: {
                  vendorShare: {
                    $round: [
                      {
                        $subtract: ['$paymentDetail.totalPrice', '$adminShare'],
                      },
                      1,
                    ],
                  },
                },
              },
              {
                $sort: {
                  purchasedOn: -1,
                },
              },
            ],
            as: 'bookingHistory',
          },
        },
        {
          $match: {
            _id: new mongoose.Types.ObjectId(vendorId),
          },
        },
      ],
    },
  },
  {
    $unwind: {
      path: '$events',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $unwind: {
      path: '$services',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $unwind: {
      path: '$bookings',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      eventHistory: '$events.eventHistory',
      serviceHistory: '$services.serviceHistory',
      bookingHistory: '$bookings.bookingHistory',
    },
  },
  {
    $addFields: {
      items: {
        $concatArrays: ['$eventHistory', '$serviceHistory', '$bookingHistory'],
      },
    },
  },
  {
    $project: {
      items: {
        $sortArray: {
          input: '$items',
          sortBy: {
            purchasedOn: -1,
          },
        },
      },
    },
  },
  {
    $unwind: {
      path: '$items',
    },
  },
  {
    $replaceRoot: {
      newRoot: '$items',
    },
  },
];

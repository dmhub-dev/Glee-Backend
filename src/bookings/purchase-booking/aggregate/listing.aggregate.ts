export const bookingHistoryAggregation = (query) => [
  {
    $match: query,
  },
  {
    $lookup: {
      from: 'bookings',
      localField: 'bookingId',
      foreignField: '_id',
      pipeline: [
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendor',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
            as: 'vendor',
          },
        },
        {
          $unwind: {
            path: '$vendor',
            preserveNullAndEmptyArrays: true,
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
            deletedAt: 0,
            isDeleted: 0,
            status: 0,
            loc: 0,
            createdAt: 0,
            updatedAt: 0,
            // endTime: 0,
            // startTime: 0,
            __v: 0,
          },
        },
      ],
      as: 'bookingId',
    },
  },
  {
    $unwind: {
      path: '$bookingId',
    },
  },
  {
    $lookup: {
      from: 'Booking-Table',
      localField: 'tableId',
      foreignField: '_id',
      pipeline: [
        {
          $project: {
            isBooked: 0,
            updatedAt: 0,
            createdAt: 0,
            __v: 0,
          },
        },
      ],
      as: 'tableId',
    },
  },
  {
    $unwind: {
      path: '$tableId',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      pipeline: [
        {
          $lookup: {
            from: 'countries',
            localField: 'country',
            foreignField: '_id',
            as: 'country',
          },
        },
        { $unwind: { path: '$country', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'cities',
            localField: 'city',
            foreignField: '_id',
            as: 'city',
          },
        },
        { $unwind: { path: '$city', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'states',
            localField: 'state',
            foreignField: '_id',
            as: 'state',
          },
        },
        { $unwind: { path: '$state', preserveNullAndEmptyArrays: true } },
      ],
      as: 'userId',
    },
  },
  {
    $unwind: {
      path: '$userId',
      preserveNullAndEmptyArrays: true,
    },
  },
  // {
  //   $match: query,
  // },
  {
    $group: {
      _id: {
        userId: '$userId',
        bookingId: '$bookingId',
        type: '$bookingType',
      },
      tables: {
        $addToSet: '$tableId',
      },
    },
  },
  {
    $project: {
      _id: 0,
      booking: '$_id.bookingId',
      table: {
        $first: '$tables',
      },
      type: '$_id.type',
      userId: '$_id.userId',
    },
  },
];

export const singleBookingHistory = (query) => [
  {
    $match: query,
  },
  {
    $lookup: {
      from: 'bookings',
      localField: 'bookingId',
      foreignField: '_id',
      pipeline: [
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
            as: 'category',
          },
        },
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendor',
            foreignField: '_id',
            pipeline: [
              {
                $project: {
                  name: 1,
                },
              },
            ],
            as: 'vendor',
          },
        },
        {
          $unwind: {
            path: '$vendor',
            preserveNullAndEmptyArrays: true,
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
            deletedAt: 0,
            isDeleted: 0,
            status: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
          },
        },
      ],
      as: 'bookingId',
    },
  },
  {
    $unwind: {
      path: '$bookingId',
    },
  },
  {
    $lookup: {
      from: 'Booking-Table',
      localField: 'tableId',
      foreignField: '_id',
      pipeline: [
        {
          $project: {
            isBooked: 0,
            updatedAt: 0,
            createdAt: 0,
            __v: 0,
          },
        },
      ],
      as: 'tableId',
    },
  },
  {
    $unwind: {
      path: '$tableId',
      preserveNullAndEmptyArrays: true,
    },
  },

  {
    $group: {
      _id: '$bookingId._id',
      tables: {
        $addToSet: '$tableId',
      },
      booking: {
        $first: '$bookingId',
      },
    },
  },
  {
    $project: {
      booking: '$booking',
      tables: '$tables',
      type: '$bookingType',
    },
  },
];

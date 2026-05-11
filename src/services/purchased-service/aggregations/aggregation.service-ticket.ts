import { ObjectId } from 'bson';

export const aggregateServiceEarning = (id) => [
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
      serviceId: new ObjectId(id),
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
      _id: '$serviceId',
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

import * as Yup from 'yup';

const addRequestValidations = {
  validateAddRequest: () => {
    return Yup.object().shape({
      requestName: Yup.string()
        .required("Request Name is required")
        .min(3, "Request Name must be at least 3 characters")
        .max(50, "Request Name can't exceed 50 characters"),
    });
  },
};

export default addRequestValidations;

import { useState, useEffect } from "react";
import axios from "axios";

const RequestForm = () => {
  const [district, setDistrict] = useState("");
  const [mandal, setMandal] = useState("");
  const [village, setVillage] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [surveyNumber, setSurveyNumber] = useState("");
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [villages, setVillages] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [liveStatuses, setLiveStatuses] = useState({});
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem("access_token");

  const generateYearOptions = () => {
    const years = [];
    for (let year = 1990; year <= 2018; year++) {
      years.push(year);
    }
    return years;
  };

  const yearOptions = generateYearOptions();

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/location/districts`)
      .then((res) => setDistricts(res.data))
      .catch((err) => console.error("Failed to fetch districts:", err));
  }, []);

  useEffect(() => {
    if (district) {
      axios
        .get(`${import.meta.env.VITE_BACKEND_URL}/location/mandals/${district}`)
        .then((res) => {
          setMandals(res.data);
          setMandal("");
          setVillage("");
          setVillages([]);
        });
    }
  }, [district]);

  useEffect(() => {
    if (district && mandal) {
      axios
        .get(
          `${
            import.meta.env.VITE_BACKEND_URL
          }/location/villages/${district}/${mandal}`
        )
        .then((res) => {
          setVillages(res.data);
          setVillage("");
        })
        .catch((err) => {
          console.error("Failed to fetch villages:", err);
        });
    }
  }, [mandal]);

  const fetchUserRequests = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/user/my-pahani-requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Fetch payment status for each processed request
      const requestsWithPaymentStatus = await Promise.all(
        res.data.map(async (req) => {
          if (req.processed && !req.is_paid) {
            try {
              const paymentRes = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/user/payment-status/${req.id}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              return { ...req, payment_status: paymentRes.data.status };
            } catch (err) {
              console.error(`Failed to fetch payment status for request ${req.id}:`, err);
              return { ...req, payment_status: "unknown" };
            }
          }
          return req;
        })
      );
      
      setUserRequests(requestsWithPaymentStatus);
    } catch (err) {
      console.error("Error fetching your requests", err);
    }
  };

  useEffect(() => {
    fetchUserRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/pahani-request`,
        {
          district,
          mandal,
          village,
          survey_number: surveyNumber,
          from_year: yearFrom,
          to_year: yearTo,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setStatus("success");
      setDistrict("");
      setMandal("");
      setVillage("");
      setYearFrom("");
      setYearTo("");
      setSurveyNumber("");
      await fetchUserRequests();
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusForRequest = async (requestId) => {
    try {
      const res = await axios.get(
        `${
          import.meta.env.VITE_BACKEND_URL
        }/user/pahani-request-status/${requestId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setLiveStatuses((prev) => ({ ...prev, [requestId]: res.data }));
    } catch (err) {
      console.error("Failed to fetch status", err);
    }
  };

  const calculatePaymentAmount = (fromYear, toYear) => {
    const yearDifference = parseInt(toYear) - parseInt(fromYear) + 1;
    return yearDifference * 10;
  };

  const handleCollectRecords = (request) => {
    setSelectedRequest(request);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    // Trim whitespace and validate transaction ID
    const trimmedTransactionId = transactionId.trim();
    
    if (!trimmedTransactionId) {
      alert("Please enter a valid transaction ID");
      return;
    }

    // Basic validation for transaction ID format (at least 6 characters)
    if (trimmedTransactionId.length < 6) {
      alert("Transaction ID must be at least 6 characters long");
      return;
    }

    setProcessingPayment(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/user/confirm-payment`,
        {
          request_id: selectedRequest.id,
          transaction_id: trimmedTransactionId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      alert(`Payment confirmation submitted successfully! Amount: ₹${response.data.amount}. Your payment is now under verification by the admin.`);
      setShowPaymentModal(false);
      setTransactionId("");
      setSelectedRequest(null);
      await fetchUserRequests();
    } catch (err) {
      console.error("Payment confirmation failed:", err);
      let errorMessage = "Payment confirmation failed. Please try again.";
      
      if (err.response?.data?.detail) {
        switch (err.response.data.detail) {
          case "Request not found":
            errorMessage = "Request not found. Please try again.";
            break;
          case "Request not yet processed":
            errorMessage = "This request has not been approved yet. Please wait for admin approval.";
            break;
          case "Payment already completed":
            errorMessage = "Payment has already been completed for this request.";
            break;
          case "Transaction ID already used":
            errorMessage = "This transaction ID has already been used. Please use a different transaction ID.";
            break;
          default:
            errorMessage = err.response.data.detail;
        }
      }
      
      alert(errorMessage);
    } finally {
      setProcessingPayment(false);
    }
  };

  const downloadPDF = async (requestId) => {
    setDownloadingId(requestId);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/user/view-pahani-pdf/${requestId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob', // Important for file downloads
        }
      );
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pahani-document-${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      let errorMessage = "Failed to download PDF.";
      
      if (err.response?.status === 403) {
        errorMessage = "Please complete payment to access the document.";
      } else if (err.response?.status === 404) {
        errorMessage = "PDF not available yet.";
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-lg border p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Pahani Document Request
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Submit a formal request to access Pahani land records, which include
            detailed information about land ownership, surveys, and history
            maintained by the Vikarabad Department.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="font-semibold text-blue-900">Processing Time</h3>
            </div>
            <p className="text-sm text-blue-700">
              Document requests are typically processed within 5-7 business
              days.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 text-green-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="font-semibold text-green-900">Verified Records</h3>
            </div>
            <p className="text-sm text-green-700">
              All provided documents are officially verified and authenticated.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 text-purple-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <h3 className="font-semibold text-purple-900">Secure Access</h3>
            </div>
            <p className="text-sm text-purple-700">
              Your request and documents are handled with complete
              confidentiality.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border">
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Request Details
          </h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Location Information
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    District *
                  </label>
                  <select
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    disabled={loading}
                  >
                    <option value="">Select District</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Mandal *
                  </label>
                  <select
                    required
                    value={mandal}
                    onChange={(e) => setMandal(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={!district || loading}
                  >
                    <option value="">Select Mandal</option>
                    {mandals.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Village *
                  </label>
                  <select
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={!mandal || loading}
                  >
                    <option value="">Select Village</option>
                    {villages.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                Date Range for Records
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    From Year *
                  </label>
                  <select
                    required
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    disabled={loading}
                  >
                    <option value="">Select Starting Year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Start year for record search (1990-2018)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    To Year *
                  </label>
                  <select
                    required
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:bg-slate-100 disabled:text-slate-500"
                    disabled={!yearFrom || loading}
                  >
                    <option value="">Select Ending Year</option>
                    {yearOptions
                      .filter((year) => year >= parseInt(yearFrom))
                      .map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    End year for record search (1990-2018)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Survey Number *
              </label>
              <input
                type="text"
                required
                value={surveyNumber}
                onChange={(e) => setSurveyNumber(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                disabled={loading}
                placeholder="e.g., 123/A"
              />
            </div>
            <div className="pt-6 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div className="text-sm text-slate-600">
                  <p className="flex items-center">
                    <svg
                      className="w-4 h-4 text-slate-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    All fields marked with * are required
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 ${
                    loading
                      ? "bg-slate-400 text-white cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin h-5 w-5 mr-3"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing Request...
                    </span>
                  ) : (
                    "Submit Official Request"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Status Messages */}
      {status === "success" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start">
            <svg
              className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Request Submitted Successfully
              </h3>
              <p className="text-green-800">
                Your Pahani document request has been submitted and is being
                processed. You will be notified once the documents are ready for
                collection.
              </p>
              <p className="text-sm text-green-700 mt-2">
                Reference ID: #
                {Math.random().toString(36).substr(2, 9).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "unauthorized" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start">
            <svg
              className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Authentication Required
              </h3>
              <p className="text-yellow-800">
                Your session has expired or you are not properly authenticated.
                Please log out and log back in to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start">
            <svg
              className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Request Submission Failed
              </h3>
              <p className="text-red-800">
                There was an error processing your request. Please check your
                information and try again. If the problem persists, contact the
                Vikarabad Department.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Request History */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Your Requests</h2>
        {userRequests.length === 0 ? (
          <p className="text-gray-600">No previous requests found.</p>
        ) : (
          <div className="space-y-4">
            {userRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 border rounded-md shadow-sm bg-gray-50"
              >
                <div className="font-medium text-gray-800">
                  {req.district} / {req.mandal} / {req.village}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  <span className="mr-4">
                    Survey No: {req.survey_number}
                  </span>
                  <span className="mr-4">
                    Years: {req.from_year} to {req.to_year}
                  </span>
                  <span className="mr-4">
                    Amount: ₹{calculatePaymentAmount(req.from_year, req.to_year)}
                  </span>
                  <span>
                    Status:{" "}
                    {req.processed
                      ? req.is_paid
                        ? "Completed"
                        : req.payment_status === "pending"
                        ? "Payment Under Verification"
                        : "Ready for Payment"
                      : "Pending Approval"}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  {/* Existing payment button */}
                  {req.processed && !req.is_paid && req.payment_status !== "pending" && (
                    <button
                      onClick={() => handleCollectRecords(req)}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors duration-200"
                    >
                      Collect Records
                    </button>
                  )}

                  {/* Download PDF button */}
                  {req.is_paid && req.pdf_s3_url && (
                    <button
                      onClick={() => downloadPDF(req.id)}
                      disabled={downloadingId === req.id}
                      className={`px-4 py-2 text-white text-sm rounded transition-colors duration-200 ${
                        downloadingId === req.id
                          ? "bg-blue-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {downloadingId === req.id ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-2 inline"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Downloading...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4 mr-2 inline"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Download PDF
                        </>
                      )}
                    </button>
                  )}

                  {/* Status indicator for PDF availability */}
                  {req.is_paid && !req.pdf_s3_url && (
                    <div className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm rounded border border-yellow-300">
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        PDF being prepared
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing payment verification status */}
                {req.processed && req.payment_status === "pending" && (
                  <div className="mt-2 px-4 py-2 bg-yellow-100 text-yellow-800 text-sm rounded border border-yellow-300">
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Payment verification in progress
                    </div>
                  </div>
                )}

                <button
                  onClick={() => fetchStatusForRequest(req.id)}
                  className="mt-2 text-sm text-blue-600 underline hover:text-blue-800"
                >
                  Check Status
                </button>
                {liveStatuses[req.id] && (
                  <div className="mt-2 text-sm text-gray-700">
                    → {liveStatuses[req.id].message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Complete Payment</h3>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Request:</strong> {selectedRequest.district} / {selectedRequest.mandal} / {selectedRequest.village}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Survey Number:</strong> {selectedRequest.survey_number}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Amount:</strong> ₹{calculatePaymentAmount(selectedRequest.from_year, selectedRequest.to_year)}
              </p>
              
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 mb-2">Scan QR Code to Pay:</p>
                <img 
                  src="/qr.svg" 
                  alt="Payment QR Code" 
                  className="mx-auto w-48 h-48 border rounded"
                />
                <p className="text-xs text-gray-500 mt-2">
                  UPI ID: government@upi
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Transaction ID *
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                placeholder="Enter your UPI transaction ID"
                disabled={processingPayment}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the transaction ID received after making the payment
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handlePaymentSubmit}
                disabled={processingPayment || !transactionId.trim()}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                  processingPayment || !transactionId.trim()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl"
                } text-white`}
              >
                {processingPayment ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "Confirm Payment"
                )}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setTransactionId("");
                  setSelectedRequest(null);
                }}
                disabled={processingPayment}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestForm;

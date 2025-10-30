import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Accordion, Card, Button, Table } from "@mantine/core";
import CommonButton from "../../../../common/Elements/Button/Button";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import iconDocument from "../../../../../assets/logo.svg";

type LocationState = {
  summary: {
    [key: string]: {
      pageSource: number[];
      usedRawText: string;
      summarizedText: string;
    };
  };
  pages: string[];
  documentS3Path: string;
};

const DocumentViewer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;

  const summary = state?.summary || {};
  const pages = state?.pages || ["No pages available."];
  const documentS3Path = state?.documentS3Path || null;

  const [highlightText, setHighlightText] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(0);
  const pageRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activePage !== null) {
      setTimeout(() => {
        const pageElement = pageRefs.current[activePage];
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [highlightText, activePage]);

  const handleSummaryClick = (usedRawText: string, pageNumber: number) => {
    setHighlightText(usedRawText);
    setActivePage(pageNumber);
  };

  const highlightMatches = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const regex = new RegExp(`(${highlight})`, "gi");
    return text.replace(regex, '<span class="bg-yellow-200">$1</span>');
  };

  const downloadPDF = async () => {
    if (!summaryRef.current) return;

    const canvas = await html2canvas(summaryRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const pageHeight = 297;
    const pxPerMm = canvas.width / imgWidth;
    const imgHeight = canvas.height / pxPerMm;

    let position = 0;
    let pageCanvas = document.createElement("canvas");
    const ctx = pageCanvas.getContext("2d")!;
    const pageHeightPx = pageHeight * pxPerMm;

    while (position < canvas.height) {
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pageHeightPx, canvas.height - position);

      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        position,
        canvas.width,
        pageCanvas.height,
        0,
        0,
        canvas.width,
        pageCanvas.height
      );

      const pageData = pageCanvas.toDataURL("image/png");
      if (position > 0) pdf.addPage();
      pdf.addImage(
        pageData,
        "PNG",
        0,
        0,
        imgWidth,
        pageCanvas.height / pxPerMm
      );
      position += pageHeightPx;
    }

    pdf.save("Discharge_Summary.pdf");
  };

  useEffect(() => {
    console.log(summary);
  }, []);

  return (
    <div className="min-h-screen p-4">
      <div className="flex justify-between mb-4">
        <Button onClick={() => navigate("/admin")} variant="outline">
          ← Back
        </Button>
        <div className="flex gap-2">
          {documentS3Path && (
            <CommonButton
              label="Download Source"
              onClick={() => window.open(documentS3Path, "_blank")}
            />
          )}
          <CommonButton label="Download Summary" onClick={downloadPDF} />
        </div>
      </div>

      <Card ref={summaryRef} shadow="sm" padding="lg" className="mb-6 w-full">
        <div className="flex items-center justify-between border-b pb-4 mb-2">
          <h2 className="text-2xl font-semibold text-gray-800">
            📄 Discharge Summary
          </h2>
          <img src={iconDocument} alt="Document Logo" className="h-20 w-20" />
        </div>

        <div className="flex justify-between border-b pb-4 mb-2">
          <div>
            <p>
              <strong>Name:</strong>{" "}
              {summary.patientName?.summarizedText || "*"}
            </p>
            <p>
              <strong>Gender:</strong> {summary.gender?.summarizedText || "*"}
            </p>
            <p>
              <strong>Age:</strong> {summary.age?.summarizedText || "*"}
            </p>
            <p>
              <strong>Admitting Doctor:</strong>{" "}
              {summary.admittingDoctor?.summarizedText || "*"}
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong>IP No:</strong> {summary.ipNo?.summarizedText || "*"}
            </p>
            <p>
              <strong>Summary No:</strong>{" "}
              {summary.summaryNumber?.summarizedText || "*"}
            </p>
            <p>
              <strong>Admission Date:</strong>{" "}
              {summary.admissionDate?.summarizedText || "*"}
            </p>
            <p>
              <strong>Discharge Date:</strong>{" "}
              {summary.dischargeDate?.summarizedText || "*"}
            </p>
          </div>
        </div>

        <h3 className="text-xl font-semibold mt-4">Diagnosis</h3>
        <p className="mb-4">{summary.diagnosis?.summarizedText || "*"}</p>

        <h3 className="text-xl font-semibold mt-4">Presenting Complaints</h3>
        <p className="mb-4">
          {summary.presentingComplaints?.summarizedText || "*"}
        </p>

        <h3 className="text-xl font-semibold mt-4">Past History</h3>
        <p className="mb-4">{summary.pastHistory?.summarizedText || "*"}</p>

        <h3 className="text-xl font-semibold mt-4 mb-2">
          Systemic Examination
        </h3>
        <table className="w-full border border-black border-collapse mb-6">
          <thead className="bg-gray-200">
            <tr>
              <th className="border border-black px-4 py-2">Exam Name</th>
              <th className="border border-black px-4 py-2">
                Value (Admission)
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.systemicExamination?.summarizedText ? (
              (() => {
                try {
                  return JSON.parse(
                    summary.systemicExamination.summarizedText.replace(
                      /[\x00-\x1F\x7F]/g,
                      ""
                    )
                  ).map((item: any, index: number) => (
                    <tr key={index} className="border border-black">
                      <td className="border border-black px-4 py-2">
                        {item.label}
                      </td>
                      <td className="border border-black px-4 py-2">
                        {item.admission}
                      </td>
                    </tr>
                  ));
                } catch (error) {
                  return (
                    <tr>
                      <td className="border border-black px-4 py-2" colSpan={2}>
                        {summary.systemicExamination.summarizedText}
                      </td>
                    </tr>
                  );
                }
              })()
            ) : (
              <tr>
                <td className="border border-black px-4 py-2" colSpan={2}>
                  *
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 className="text-xl font-semibold mt-4">
          Summary of Key Investigations
        </h3>
        <p className="mb-4">
          {summary.keyInvestigationSummary?.summarizedText || "*"}
        </p>

        <h3 className="text-xl font-semibold mt-4">Hospital Course</h3>
        <p className="mb-4">{summary.hospitalCourse?.summarizedText || "*"}</p>

        <h3 className="text-xl font-semibold mt-4">
          Treatment During Hospitalization
        </h3>
        <p className="text-l font-semibold mt-4">Drug Names</p>
        {summary.hospitalizationTreatment?.summarizedText
          ? summary.hospitalizationTreatment.summarizedText
              .split(", ")
              .map((drug, index) => (
                <p key={index} className="ml-4">
                  • {drug}
                </p>
              ))
          : "*"}

        <h3 className="text-xl font-semibold mt-4 mb-2">
          Treatment on Discharge
        </h3>
        <table className="w-full border border-black border-collapse mb-4">
          <thead className="bg-gray-200">
            <tr>
              <th className="border border-black px-4 py-2">Drug Name</th>
              <th className="border border-black px-4 py-2">Dosage</th>
              <th className="border border-black px-4 py-2">Frequency</th>
              <th className="border border-black px-4 py-2">Duration</th>
              <th className="border border-black px-4 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {summary.dischargeTreatment?.summarizedText ? (
              (() => {
                try {
                  return JSON.parse(
                    summary.dischargeTreatment.summarizedText.replace(
                      /[\x00-\x1F\x7F]/g,
                      ""
                    )
                  ).map((drug: any, index: number) => (
                    <tr key={index} className="border border-black">
                      <td className="border border-black px-4 py-2">
                        {drug.drugName}
                      </td>
                      <td className="border border-black px-4 py-2">
                        {drug.dosage || "-"}
                      </td>
                      <td className="border border-black px-4 py-2">
                        {drug.frequency || "-"}
                      </td>
                      <td className="border border-black px-4 py-2">
                        {drug.numberOfDays || "-"}
                      </td>
                      <td className="border border-black px-4 py-2">
                        {drug.remark || "-"}
                      </td>
                    </tr>
                  ));
                } catch (error) {
                  return (
                    <tr>
                      <td className="border border-black px-4 py-2" colSpan={5}>
                        {summary.dischargeTreatment.summarizedText}
                      </td>
                    </tr>
                  );
                }
              })()
            ) : (
              <tr>
                <td
                  className="border border-black px-4 py-2 text-center"
                  colSpan={5}
                >
                  No treatment details available.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 className="text-xl font-semibold mt-4">Advice</h3>
        <p>{summary.advice?.summarizedText || "*"}</p>

        <h3 className="text-xl font-semibold mt-4">Preventive Care</h3>
        <p>{summary.preventiveCare?.summarizedText || "*"}</p>

        <h3 className="text-xl font-semibold mt-4">
          When to Obtain Urgent Care
        </h3>
        <p>{summary.obtainUrgentCare?.summarizedText || "*"}</p>
      </Card>

      <Accordion
        value={`page-${activePage}`}
        defaultValue="page-0"
        className="print:hidden"
      >
        {pages.map((page, index) => (
          <Accordion.Item key={index} value={`page-${index}`}>
            <Accordion.Control onClick={() => setActivePage(index)}>
              <span className="text-lg font-semibold">📑 Page {index + 1}</span>
            </Accordion.Control>
            <Accordion.Panel>
              <p
                ref={(el) => (pageRefs.current[index] = el)}
                className="text-gray-700 p-2 rounded-md"
                dangerouslySetInnerHTML={{
                  __html:
                    index === activePage
                      ? highlightMatches(page, highlightText)
                      : page,
                }}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
};

export default DocumentViewer;
